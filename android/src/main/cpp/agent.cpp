#include <jni.h>
#include <jvmti.h>  // vendored, see vendor/jvmti.h
#include <android/log.h>
#include <arpa/inet.h>
#include <netinet/in.h>
#include <sys/socket.h>
#include <unistd.h>
#include <cstdlib>
#include <cstring>
#include <string>
#include <thread>
#include <vector>

#define LOG_TAG "Hotswap"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, LOG_TAG, __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, LOG_TAG, __VA_ARGS__)

namespace {

constexpr int kDefaultPort = 8099;
constexpr const char* kStructuralRedefine =
    "com.android.art.class.structurally_redefine_classes";

JavaVM* gVm = nullptr;
jvmtiEnv* gJvmti = nullptr;

using StructuralRedefineFn = jvmtiError (*)(jvmtiEnv*, jint, const jvmtiClassDefinition*);
StructuralRedefineFn gStructuralRedefine = nullptr;

// ART exposes structural redefinition as a JVMTI extension rather than a normal
// entrypoint, so it has to be looked up by name at attach time. Its absence is
// what tells us the device is below Android 11.
void resolveStructuralRedefine() {
  jint count = 0;
  jvmtiExtensionFunctionInfo* extensions = nullptr;
  if (gJvmti->GetExtensionFunctions(&count, &extensions) != JVMTI_ERROR_NONE) {
    return;
  }

  for (jint i = 0; i < count; i++) {
    if (std::strcmp(extensions[i].id, kStructuralRedefine) == 0) {
      gStructuralRedefine = reinterpret_cast<StructuralRedefineFn>(extensions[i].func);
    }
  }

  gJvmti->Deallocate(reinterpret_cast<unsigned char*>(extensions));
}

// FindClass on the agent's own thread resolves against the system classloader, which
// cannot see app classes. Walking the loaded classes finds it in whatever loader owns it.
jclass findLoadedClass(JNIEnv* env, const std::string& className) {
  const std::string wanted = "L" + className + ";";

  jint count = 0;
  jclass* classes = nullptr;
  if (gJvmti->GetLoadedClasses(&count, &classes) != JVMTI_ERROR_NONE) {
    return nullptr;
  }

  jclass found = nullptr;
  for (jint i = 0; i < count && found == nullptr; i++) {
    char* signature = nullptr;
    if (gJvmti->GetClassSignature(classes[i], &signature, nullptr) != JVMTI_ERROR_NONE) {
      continue;
    }
    if (signature != nullptr && wanted == signature) {
      found = static_cast<jclass>(env->NewLocalRef(classes[i]));
    }
    gJvmti->Deallocate(reinterpret_cast<unsigned char*>(signature));
  }

  for (jint i = 0; i < count; i++) env->DeleteLocalRef(classes[i]);
  gJvmti->Deallocate(reinterpret_cast<unsigned char*>(classes));

  return found;
}

jvmtiError redefine(const std::string& className, const std::vector<unsigned char>& dex) {
  JNIEnv* env = nullptr;
  if (gVm->AttachCurrentThread(&env, nullptr) != JNI_OK) {
    return JVMTI_ERROR_INTERNAL;
  }

  jclass target = findLoadedClass(env, className);
  if (target == nullptr) {
    gVm->DetachCurrentThread();
    return JVMTI_ERROR_INVALID_CLASS;
  }

  jvmtiClassDefinition definition{};
  definition.klass = target;
  definition.class_byte_count = static_cast<jint>(dex.size());
  definition.class_bytes = dex.data();

  // Structural redefinition accepts added methods and fields; the classic call
  // only swaps existing method bodies. Prefer the former, fall back to the
  // latter so Android 10 still gets something.
  const jvmtiError result = gStructuralRedefine != nullptr
                                ? gStructuralRedefine(gJvmti, 1, &definition)
                                : gJvmti->RedefineClasses(1, &definition);

  env->DeleteLocalRef(target);
  gVm->DetachCurrentThread();

  return result;
}

bool readExactly(int fd, void* into, size_t size) {
  auto* cursor = static_cast<unsigned char*>(into);
  size_t read = 0;
  while (read < size) {
    const ssize_t chunk = recv(fd, cursor + read, size - read, 0);
    if (chunk <= 0) return false;
    read += static_cast<size_t>(chunk);
  }
  return true;
}

// Wire format, all big endian: [u32 nameLength][name][u32 dexLength][dex].
// The reply is a single byte: 0 for success, otherwise the jvmtiError.
void serveConnection(int client) {
  while (true) {
    uint32_t nameLength = 0;
    if (!readExactly(client, &nameLength, sizeof(nameLength))) return;
    nameLength = ntohl(nameLength);
    if (nameLength == 0 || nameLength > 1024) return;

    std::string className(nameLength, '\0');
    if (!readExactly(client, className.data(), nameLength)) return;

    uint32_t dexLength = 0;
    if (!readExactly(client, &dexLength, sizeof(dexLength))) return;
    dexLength = ntohl(dexLength);
    if (dexLength == 0) return;

    std::vector<unsigned char> dex(dexLength);
    if (!readExactly(client, dex.data(), dexLength)) return;

    const jvmtiError error = redefine(className, dex);
    if (error == JVMTI_ERROR_NONE) {
      LOGI("redefined %s (%u bytes)", className.c_str(), dexLength);
    } else {
      LOGE("failed to redefine %s: jvmtiError %d", className.c_str(), error);
    }

    const unsigned char reply = static_cast<unsigned char>(error);
    if (send(client, &reply, 1, 0) != 1) return;
  }
}

void listenForever(int port) {
  const int server = socket(AF_INET, SOCK_STREAM, 0);
  if (server < 0) {
    LOGE("could not open socket: %s", std::strerror(errno));
    return;
  }

  int reuse = 1;
  setsockopt(server, SOL_SOCKET, SO_REUSEADDR, &reuse, sizeof(reuse));

  sockaddr_in address{};
  address.sin_family = AF_INET;
  address.sin_addr.s_addr = htonl(INADDR_LOOPBACK);
  address.sin_port = htons(static_cast<uint16_t>(port));

  if (bind(server, reinterpret_cast<sockaddr*>(&address), sizeof(address)) < 0) {
    LOGE("could not bind port %d: %s", port, std::strerror(errno));
    close(server);
    return;
  }

  listen(server, 1);
  LOGI("listening on 127.0.0.1:%d", port);

  while (true) {
    const int client = accept(server, nullptr, nullptr);
    if (client < 0) continue;
    serveConnection(client);
    close(client);
  }
}

int portFrom(const char* options) {
  if (options == nullptr) return kDefaultPort;
  const char* found = std::strstr(options, "port=");
  if (found == nullptr) return kDefaultPort;
  const int parsed = std::atoi(found + 5);
  return parsed > 0 ? parsed : kDefaultPort;
}

}  // namespace

extern "C" JNIEXPORT jint JNICALL
Agent_OnAttach(JavaVM* vm, char* options, void* /* reserved */) {
  gVm = vm;

  if (vm->GetEnv(reinterpret_cast<void**>(&gJvmti), JVMTI_VERSION_1_2) != JNI_OK) {
    LOGE("could not get a jvmtiEnv");
    return JNI_ERR;
  }

  // can_redefine_any_class covers system classes and ART does not always grant it, so
  // ask for only what it says it has rather than failing the whole attach.
  jvmtiCapabilities available{};
  gJvmti->GetPotentialCapabilities(&available);
  LOGI("ART offers redefine_classes=%d redefine_any_class=%d",
       available.can_redefine_classes, available.can_redefine_any_class);

  jvmtiCapabilities wanted{};
  wanted.can_redefine_classes = available.can_redefine_classes;
  wanted.can_redefine_any_class = available.can_redefine_any_class;

  const jvmtiError capabilityError = gJvmti->AddCapabilities(&wanted);
  if (capabilityError != JVMTI_ERROR_NONE) {
    LOGE("could not add redefinition capabilities: jvmtiError %d", capabilityError);
    return JNI_ERR;
  }

  resolveStructuralRedefine();
  LOGI("attached, structural redefinition %s",
       gStructuralRedefine != nullptr ? "available" : "unavailable");

  std::thread(listenForever, portFrom(options)).detach();

  return JNI_OK;
}
