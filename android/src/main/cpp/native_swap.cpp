#include <android/log.h>
#include <dlfcn.h>
#include <link.h>
#include <sys/mman.h>
#include <unistd.h>
#include <cstdio>
#include <cstring>
#include <vector>

#include "native_swap.h"

#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, "Hotswap", __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, "Hotswap", __VA_ARGS__)

namespace {

struct Replacement {
  const void* address;
  const char* name;
  uint32_t room;
};

// b <target>, when the two sit within the 128MB an imm26 displacement reaches.
constexpr size_t kNearJump = 4;

// ldr x16, #8 ; br x16 ; .quad target, for when they do not.
constexpr size_t kFarJump = 16;

constexpr intptr_t kBranchReach = 1 << 27;

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

bool reachable(const void* from, const void* to) {
  const intptr_t delta = reinterpret_cast<intptr_t>(to) - reinterpret_cast<intptr_t>(from);

  return delta >= -kBranchReach && delta < kBranchReach;
}

struct Arena {
  uintptr_t base;
  size_t used;
};

std::vector<Arena> gArenas;

/**
 * Finds sixteen bytes of executable memory a four-byte branch can reach from the original.
 *
 * The patch library is mapped wherever the linker likes, which is routinely further than
 * imm26 covers, and the far jump needs sixteen bytes that a small function does not have.
 */
void* trampolineNear(void* target) {
  const size_t page = static_cast<size_t>(getpagesize());

  for (Arena& arena : gArenas) {
    auto slot = reinterpret_cast<void*>(arena.base + arena.used);
    if (arena.used + kFarJump > page || !reachable(target, slot)) continue;

    arena.used += kFarJump;

    return slot;
  }

  // mmap treats the address as a hint and is free to ignore it, so each candidate is
  // checked rather than trusted, and the search widens until imm26 runs out.
  for (intptr_t step = static_cast<intptr_t>(page); step < kBranchReach; step <<= 1) {
    for (int sign = 1; sign >= -1; sign -= 2) {
      auto hint = (reinterpret_cast<uintptr_t>(target) + static_cast<uintptr_t>(sign * step)) &
                  ~static_cast<uintptr_t>(page - 1);
      void* got = mmap(reinterpret_cast<void*>(hint), page, PROT_READ | PROT_WRITE,
                       MAP_PRIVATE | MAP_ANONYMOUS, -1, 0);
      if (got == MAP_FAILED) continue;

      if (reachable(target, got)) {
        gArenas.push_back(Arena{reinterpret_cast<uintptr_t>(got), kFarJump});

        return got;
      }

      munmap(got, page);
    }
  }

  return nullptr;
}

bool writeFarJump(void* into, const void* to) {
  const size_t page = static_cast<size_t>(getpagesize());
  auto start = reinterpret_cast<void*>(reinterpret_cast<uintptr_t>(into) & ~(page - 1));

  if (mprotect(start, page, PROT_READ | PROT_WRITE) != 0) return false;

  const uint32_t code[2] = {0x58000050, 0xD61F0200};
  std::memcpy(into, code, sizeof(code));
  std::memcpy(static_cast<char*>(into) + sizeof(code), &to, sizeof(to));

  if (mprotect(start, page, PROT_READ | PROT_EXEC) != 0) return false;

  __builtin___clear_cache(static_cast<char*>(into), static_cast<char*>(into) + kFarJump);

  return true;
}

bool makeWritable(void* from, size_t width) {
  const size_t page = static_cast<size_t>(getpagesize());
  auto start = reinterpret_cast<uintptr_t>(from) & ~(page - 1);
  const size_t span = (reinterpret_cast<uintptr_t>(from) + width) - start;

  return mprotect(reinterpret_cast<void*>(start), span,
                  PROT_READ | PROT_WRITE | PROT_EXEC) == 0;
}

bool writeJump(void* from, const Replacement& to) {
  const void* landing = to.address;

  if (!reachable(from, landing)) {
    landing = trampolineNear(from);
    if (landing == nullptr || !writeFarJump(const_cast<void*>(landing), to.address)) {
      LOGE("%s is out of branch range and no trampoline fit; rebuild", to.name);
      return false;
    }
  }

  // Four bytes is the whole of the shortest function arm64 emits, so with a trampoline in
  // reach there is no function too small to redirect.
  if (to.room < kNearJump) {
    LOGE("%s is %u bytes, too short to redirect; rebuild", to.name, to.room);
    return false;
  }

  if (!makeWritable(from, kNearJump)) {
    LOGE("could not make %p writable: %s", from, std::strerror(errno));
    return false;
  }

  const intptr_t delta =
      reinterpret_cast<intptr_t>(landing) - reinterpret_cast<intptr_t>(from);
  const uint32_t branch = 0x14000000u | (static_cast<uint32_t>(delta >> 2) & 0x03FFFFFFu);
  std::memcpy(from, &branch, sizeof(branch));

  // The old bytes may still sit in the instruction cache.
  __builtin___clear_cache(static_cast<char*>(from), static_cast<char*>(from) + kNearJump);

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

    if (writeJump(original, Replacement{fresh, symbol.name.c_str(), symbol.size})) hooked++;
  }

  LOGI("loaded %s, redirected %u of %zu function(s)", path.c_str(), hooked, symbols.size());

  return hooked > 0 ? 0 : 2;
}
