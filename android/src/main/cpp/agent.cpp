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

#include "native_swap.h"

#define LOG_TAG "Hotswap"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, LOG_TAG, __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, LOG_TAG, __VA_ARGS__)

namespace {

constexpr int kDefaultPort = 8099;
constexpr unsigned char kClasses = 0;
constexpr unsigned char kNative = 1;
constexpr unsigned char kGeneration = 2;
constexpr unsigned char kNotice = 3;
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

  // Every copy: a generation loads the same class again, under its own loader.
  std::vector<jclass> find(const std::string& className) const {
    const std::string wanted = "L" + className + ";";
    std::vector<jclass> found;

    for (jint i = 0; i < count_; i++) {
      char* signature = nullptr;
      if (gJvmti->GetClassSignature(classes_[i], &signature, nullptr) != JVMTI_ERROR_NONE) {
        continue;
      }

      const bool match = signature != nullptr && wanted == signature;
      gJvmti->Deallocate(reinterpret_cast<unsigned char*>(signature));

      if (match) found.push_back(classes_[i]);
    }

    return found;
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

  // Releasing LoadedClasses' local references after detaching aborts the runtime.
  {
    // GetLoadedClasses walks every class the runtime holds, so the batch takes one snapshot.
    const LoadedClasses loaded(env);

    std::vector<jvmtiClassDefinition> classes;
    classes.reserve(definitions.size());

    for (const Definition& definition : definitions) {
      const std::vector<jclass> targets = loaded.find(definition.className);

      // A class not reached yet will load from the dex on disk, so skipping beats failing.
      if (targets.empty()) {
        LOGI("skipping %s, not loaded yet", definition.className.c_str());
        continue;
      }

      for (jclass target : targets) {
        jvmtiClassDefinition entry{};
        entry.klass = target;
        entry.class_byte_count = static_cast<jint>(definition.dex.size());
        entry.class_bytes = definition.dex.data();
        classes.push_back(entry);
      }
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

bool serveClasses(int client, unsigned char& reply) {
  uint32_t count = 0;
  if (!readExactly(client, &count, sizeof(count))) return false;
  count = ntohl(count);
  if (count == 0 || count > 256) return false;

  std::vector<Definition> definitions(count);
  for (uint32_t i = 0; i < count; i++) {
    if (!readString(client, definitions[i].className)) return false;
    if (!readBytes(client, definitions[i].dex)) return false;
  }

  const jvmtiError error = redefine(definitions);
  if (error == JVMTI_ERROR_NONE) {
    LOGI("redefined %u class(es), first %s", count, definitions[0].className.c_str());
  } else {
    LOGE("failed to redefine %s: jvmtiError %d", definitions[0].className.c_str(), error);
  }

  reply = static_cast<unsigned char>(error);

  return true;
}

unsigned char publishGeneration(const std::vector<std::vector<unsigned char>>& dexes,
                                const std::vector<std::string>& names) {
  JNIEnv* env = nullptr;
  if (gVm->AttachCurrentThread(&env, nullptr) != JNI_OK) return 1;

  unsigned char reply = 1;
  {
    LoadedClasses loaded(env);
    const std::vector<jclass> found = loaded.find("com/hotswap/HotswapGenerations");
    jclass generations = found.empty() ? nullptr : found.front();

    if (generations == nullptr) {
      LOGE("HotswapGenerations is not loaded; is the app on a hotswap React host?");
    } else {
      jmethodID publish =
          env->GetStaticMethodID(generations, "publish", "([[B[Ljava/lang/String;)Z");

      if (publish == nullptr) {
        env->ExceptionClear();
        LOGE("HotswapGenerations.publish is missing");
      } else {
        jobjectArray dexArray =
            env->NewObjectArray(static_cast<jsize>(dexes.size()), env->FindClass("[B"), nullptr);
        for (size_t i = 0; i < dexes.size(); i++) {
          jbyteArray one = env->NewByteArray(static_cast<jsize>(dexes[i].size()));
          env->SetByteArrayRegion(one, 0, static_cast<jsize>(dexes[i].size()),
                                  reinterpret_cast<const jbyte*>(dexes[i].data()));
          env->SetObjectArrayElement(dexArray, static_cast<jsize>(i), one);
          env->DeleteLocalRef(one);
        }

        jobjectArray nameArray = env->NewObjectArray(
            static_cast<jsize>(names.size()), env->FindClass("java/lang/String"), nullptr);
        for (size_t i = 0; i < names.size(); i++) {
          jstring one = env->NewStringUTF(names[i].c_str());
          env->SetObjectArrayElement(nameArray, static_cast<jsize>(i), one);
          env->DeleteLocalRef(one);
        }

        reply = env->CallStaticBooleanMethod(generations, publish, dexArray, nameArray) ? 0 : 1;

        env->DeleteLocalRef(dexArray);
        env->DeleteLocalRef(nameArray);
      }
    }
  }

  gVm->DetachCurrentThread();

  return reply;
}

unsigned char showNotice(const std::string& title, const std::string& detail) {
  JNIEnv* env = nullptr;
  if (gVm->AttachCurrentThread(&env, nullptr) != JNI_OK) return 1;

  unsigned char reply = 1;
  {
    LoadedClasses loaded(env);
    const std::vector<jclass> found = loaded.find("com/hotswap/HotswapNotice");
    jclass notice = found.empty() ? nullptr : found.front();

    if (notice != nullptr) {
      jmethodID show = env->GetStaticMethodID(
          notice, "show", "(Ljava/lang/String;Ljava/lang/String;)V");

      if (show == nullptr) {
        env->ExceptionClear();
      } else {
        jstring first = env->NewStringUTF(title.c_str());
        jstring second = env->NewStringUTF(detail.c_str());
        env->CallStaticVoidMethod(notice, show, first, second);
        env->DeleteLocalRef(first);
        env->DeleteLocalRef(second);
        reply = 0;
      }
    }
  }

  gVm->DetachCurrentThread();

  return reply;
}

bool serveNotice(int client, unsigned char& reply) {
  std::string title;
  if (!readString(client, title)) return false;

  std::string detail;
  if (!readString(client, detail)) return false;

  reply = showNotice(title, detail);

  return true;
}

bool serveGeneration(int client, unsigned char& reply) {
  uint32_t dexCount = 0;
  if (!readExactly(client, &dexCount, sizeof(dexCount))) return false;
  dexCount = ntohl(dexCount);
  if (dexCount == 0 || dexCount > 64) return false;

  std::vector<std::vector<unsigned char>> dexes(dexCount);
  for (uint32_t i = 0; i < dexCount; i++) {
    if (!readBytes(client, dexes[i])) return false;
  }

  uint32_t nameCount = 0;
  if (!readExactly(client, &nameCount, sizeof(nameCount))) return false;
  nameCount = ntohl(nameCount);
  if (nameCount == 0 || nameCount > 1024) return false;

  std::vector<std::string> names(nameCount);
  for (uint32_t i = 0; i < nameCount; i++) {
    if (!readString(client, names[i])) return false;
  }

  reply = publishGeneration(dexes, names);

  return true;
}

bool serveNative(int client, const std::string& filesDir, unsigned char& reply) {
  std::vector<unsigned char> image;
  if (!readBytes(client, image)) return false;

  uint32_t count = 0;
  if (!readExactly(client, &count, sizeof(count))) return false;
  count = ntohl(count);
  if (count == 0 || count > 8192) return false;

  std::vector<NativeSymbol> symbols(count);
  for (uint32_t i = 0; i < count; i++) {
    if (!readString(client, symbols[i].name)) return false;

    uint32_t size = 0;
    if (!readExactly(client, &size, sizeof(size))) return false;
    symbols[i].size = ntohl(size);
  }

  reply = hotswapLoadNative(filesDir, image, symbols);

  return true;
}

void serveConnection(int client, const std::string& filesDir) {
  while (true) {
    unsigned char kind = 0;
    if (!readExactly(client, &kind, sizeof(kind))) return;
    if (kind > kNotice) return;

    unsigned char reply = 0;
    bool served = false;
    if (kind == kNotice) served = serveNotice(client, reply);
    else if (kind == kGeneration) served = serveGeneration(client, reply);
    else if (kind == kNative) served = serveNative(client, filesDir, reply);
    else served = serveClasses(client, reply);
    if (!served) return;
    if (send(client, &reply, 1, 0) != 1) return;
  }
}

void listenForever(int port, std::string filesDir) {
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

    if (client < 0) {
      // Anything but EINTR means the socket is gone, and looping would spin a core.
      if (errno == EINTR || errno == ECONNABORTED) continue;

      LOGE("accept failed: %s", std::strerror(errno));
      break;
    }

    serveConnection(client, filesDir);
    close(client);
  }

  close(server);
}

std::string valueFrom(const char* options, const char* key) {
  if (options == nullptr) return "";
  const char* at = std::strstr(options, key);
  if (at == nullptr) return "";
  at += std::strlen(key);
  const char* end = std::strchr(at, ',');

  return end == nullptr ? std::string(at) : std::string(at, (size_t)(end - at));
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

  std::thread(listenForever, portFrom(options), valueFrom(options, "files=")).detach();

  return JNI_OK;
}
