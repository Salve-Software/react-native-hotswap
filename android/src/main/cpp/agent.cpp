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

struct Definition {
  std::string className;
  std::vector<unsigned char> dex;
};

class LoadedClasses {
 public:
  explicit LoadedClasses(JNIEnv* env) : env_(env) {
    if (gJvmti->GetLoadedClasses(&count_, &classes_) != JVMTI_ERROR_NONE) count_ = 0;
  }

  ~LoadedClasses() {
    for (jint i = 0; i < count_; i++) env_->DeleteLocalRef(classes_[i]);
    if (classes_ != nullptr) gJvmti->Deallocate(reinterpret_cast<unsigned char*>(classes_));
  }

  jclass find(const std::string& className) const {
    const std::string wanted = "L" + className + ";";

    for (jint i = 0; i < count_; i++) {
      char* signature = nullptr;
      if (gJvmti->GetClassSignature(classes_[i], &signature, nullptr) != JVMTI_ERROR_NONE) {
        continue;
      }

      const bool match = signature != nullptr && wanted == signature;
      gJvmti->Deallocate(reinterpret_cast<unsigned char*>(signature));

      if (match) return classes_[i];
    }

    return nullptr;
  }

 private:
  JNIEnv* env_;
  jint count_ = 0;
  jclass* classes_ = nullptr;
};

jvmtiError redefine(const std::vector<Definition>& definitions) {
  JNIEnv* env = nullptr;
  if (gVm->AttachCurrentThread(&env, nullptr) != JNI_OK) {
    return JVMTI_ERROR_INTERNAL;
  }

  jvmtiError result = JVMTI_ERROR_INVALID_CLASS;

  // Everything JNI has to finish inside this block: the local references are released by
  // LoadedClasses' destructor, and doing that after detaching aborts the runtime.
  {
    // One snapshot for the whole batch. GetLoadedClasses walks every class the runtime
    // holds, and calling it per definition turned a four-class swap into four full scans.
    const LoadedClasses loaded(env);

    std::vector<jvmtiClassDefinition> classes;
    classes.reserve(definitions.size());

    for (const Definition& definition : definitions) {
      jclass target = loaded.find(definition.className);

      // A lambda the runtime has not reached yet cannot be redefined, and does not need to
      // be: it will load from the dex on disk. Skipping beats failing the whole swap.
      if (target == nullptr) {
        LOGI("skipping %s, not loaded yet", definition.className.c_str());
        continue;
      }

      jvmtiClassDefinition entry{};
      entry.klass = target;
      entry.class_byte_count = static_cast<jint>(definition.dex.size());
      entry.class_bytes = definition.dex.data();
      classes.push_back(entry);
    }

    if (!classes.empty()) {
      const jint count = static_cast<jint>(classes.size());

      result = gStructuralRedefine != nullptr
                   ? gStructuralRedefine(gJvmti, count, classes.data())
                   : gJvmti->RedefineClasses(count, classes.data());
    }
  }

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

bool readString(int client, std::string& into) {
  uint32_t length = 0;
  if (!readExactly(client, &length, sizeof(length))) return false;
  length = ntohl(length);
  if (length == 0 || length > 1024) return false;

  into.resize(length);

  return readExactly(client, into.data(), length);
}

bool readBytes(int client, std::vector<unsigned char>& into) {
  uint32_t length = 0;
  if (!readExactly(client, &length, sizeof(length))) return false;
  length = ntohl(length);
  if (length == 0 || length > 64 * 1024 * 1024) return false;

  into.resize(length);

  return readExactly(client, into.data(), length);
}

void serveConnection(int client) {
  while (true) {
    uint32_t count = 0;
    if (!readExactly(client, &count, sizeof(count))) return;
    count = ntohl(count);
    if (count == 0 || count > 256) return;

    std::vector<Definition> definitions(count);
    for (uint32_t i = 0; i < count; i++) {
      if (!readString(client, definitions[i].className)) return;
      if (!readBytes(client, definitions[i].dex)) return;
    }

    const jvmtiError error = redefine(definitions);
    if (error == JVMTI_ERROR_NONE) {
      LOGI("redefined %u class(es), first %s", count, definitions[0].className.c_str());
    } else {
      LOGE("failed to redefine %s: jvmtiError %d", definitions[0].className.c_str(), error);
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
