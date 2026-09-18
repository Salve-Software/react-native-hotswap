#include <android/log.h>
#include <dlfcn.h>
#include <link.h>
#include <sys/mman.h>
#include <unistd.h>
#include <cstdio>
#include <cstring>

#include "native_swap.h"

#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, "Hotswap", __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, "Hotswap", __VA_ARGS__)

namespace {

// ldr x16, #8 ; br x16 ; .quad target. A shorter original would lose its neighbour.
constexpr size_t kJumpSize = 16;

unsigned int gLoaded = 0;

int collectPath(dl_phdr_info* info, size_t, void* into) {
  if (info->dlpi_name != nullptr && info->dlpi_name[0] != '\0') {
    static_cast<std::vector<std::string>*>(into)->emplace_back(info->dlpi_name);
  }

  return 0;
}

std::vector<std::string> loadedLibraries() {
  std::vector<std::string> paths;
  dl_iterate_phdr(collectPath, &paths);

  return paths;
}

// RTLD_NOLOAD asks the linker without ever pulling a new library in.
void* findOriginal(const std::vector<std::string>& paths, const char* name, void* except) {
  for (const std::string& path : paths) {
    void* handle = dlopen(path.c_str(), RTLD_NOW | RTLD_NOLOAD);
    if (handle == nullptr) continue;
    if (handle == except) {
      dlclose(handle);
      continue;
    }

    void* found = dlsym(handle, name);
    dlclose(handle);

    if (found != nullptr) return found;
  }

  return nullptr;
}

bool writeJump(void* from, void* to) {
  const size_t page = static_cast<size_t>(getpagesize());
  auto start = reinterpret_cast<uintptr_t>(from) & ~(page - 1);
  const size_t span = (reinterpret_cast<uintptr_t>(from) + kJumpSize) - start;

  if (mprotect(reinterpret_cast<void*>(start), span,
               PROT_READ | PROT_WRITE | PROT_EXEC) != 0) {
    LOGE("could not make %p writable: %s", from, std::strerror(errno));
    return false;
  }

  const uint32_t code[2] = {0x58000050, 0xD61F0200};
  std::memcpy(from, code, sizeof(code));
  std::memcpy(static_cast<char*>(from) + sizeof(code), &to, sizeof(to));

  // The old bytes may still sit in the instruction cache.
  __builtin___clear_cache(static_cast<char*>(from),
                          static_cast<char*>(from) + kJumpSize);

  return true;
}

bool write(const std::string& path, const std::vector<unsigned char>& image) {
  FILE* file = fopen(path.c_str(), "wb");
  if (file == nullptr) return false;

  const bool ok = fwrite(image.data(), 1, image.size(), file) == image.size();
  fclose(file);

  return ok;
}

}  // namespace

unsigned char hotswapLoadNative(const std::string& filesDir,
                                const std::vector<unsigned char>& image,
                                const std::vector<NativeSymbol>& symbols) {
  // The linker keys a library on the path it was opened with, so the name must differ.
  const std::string path = filesDir + "/hotswap-patch-" + std::to_string(gLoaded++) + ".so";

  if (!write(path, image)) {
    LOGE("could not write %s", path.c_str());
    return 1;
  }

  void* patch = dlopen(path.c_str(), RTLD_NOW | RTLD_LOCAL);
  if (patch == nullptr) {
    LOGE("could not load %s: %s", path.c_str(), dlerror());
    return 1;
  }

  const std::vector<std::string> paths = loadedLibraries();
  unsigned int hooked = 0;

  for (const NativeSymbol& symbol : symbols) {
    void* fresh = dlsym(patch, symbol.name.c_str());
    if (fresh == nullptr) continue;

    void* original = findOriginal(paths, symbol.name.c_str(), patch);
    if (original == nullptr || original == fresh) continue;

    if (symbol.size < kJumpSize) {
      LOGE("%s is %u bytes, too short to redirect; rebuild", symbol.name.c_str(),
           symbol.size);
      continue;
    }

    if (writeJump(original, fresh)) hooked++;
  }

  LOGI("loaded %s, redirected %u of %zu function(s)", path.c_str(), hooked, symbols.size());

  return hooked > 0 ? 0 : 2;
}
