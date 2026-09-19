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

#if defined(__aarch64__)

/** `B` is one instruction and reaches 128MB either way. */
constexpr size_t kNearJump = 4;
constexpr intptr_t kBranchReach = 1 << 27;

#elif defined(__x86_64__)

/** `E9 rel32` is five bytes and reaches 2GB either way, held short of the edge so a
    displacement cannot land on the boundary. */
constexpr size_t kNearJump = 5;
constexpr intptr_t kBranchReach = (static_cast<intptr_t>(1) << 31) - 64;

#else

constexpr size_t kNearJump = 4;
constexpr intptr_t kBranchReach = 0;

#endif

/** Wide enough for either far jump, and a multiple of eight so the address behind one
    stays aligned. */
constexpr size_t kFarJump = 16;

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

void* trampolineNear(void* target) {
  const size_t page = static_cast<size_t>(getpagesize());

  for (Arena& arena : gArenas) {
    auto slot = reinterpret_cast<void*>(arena.base + arena.used);
    if (arena.used + kFarJump > page || !reachable(target, slot)) continue;

    arena.used += kFarJump;

    return slot;
  }

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

#if defined(__aarch64__)
  // LDR x16, #8 then BR x16, reading the address that sits right behind them.
  const uint32_t code[2] = {0x58000050, 0xD61F0200};

  std::memcpy(into, code, sizeof(code));
  std::memcpy(static_cast<char*>(into) + sizeof(code), &to, sizeof(to));
#elif defined(__x86_64__)
  // jmp qword ptr [rip+0], reading the address that sits right behind it.
  const unsigned char code[6] = {0xFF, 0x25, 0x00, 0x00, 0x00, 0x00};

  std::memcpy(into, code, sizeof(code));
  std::memcpy(static_cast<char*>(into) + sizeof(code), &to, sizeof(to));
#else
  static_cast<void>(to);
  mprotect(start, page, PROT_READ | PROT_EXEC);

  return false;
#endif

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
#if !defined(__aarch64__) && !defined(__x86_64__)
  LOGE("%s cannot be redirected: no jump is written for this architecture", to.name);

  return false;
#else
  const void* landing = to.address;

  if (!reachable(from, landing)) {
    landing = trampolineNear(from);
    if (landing == nullptr || !writeFarJump(const_cast<void*>(landing), to.address)) {
      LOGE("%s is out of branch range and no trampoline fit; rebuild", to.name);
      return false;
    }
  }

  if (to.room < kNearJump) {
    LOGE("%s is %u bytes, too short to redirect; rebuild", to.name, to.room);
    return false;
  }

  if (!makeWritable(from, kNearJump)) {
    LOGE("could not make %p writable: %s", from, std::strerror(errno));
    return false;
  }

#if defined(__aarch64__)
  const intptr_t delta =
      reinterpret_cast<intptr_t>(landing) - reinterpret_cast<intptr_t>(from);
  const uint32_t branch = 0x14000000u | (static_cast<uint32_t>(delta >> 2) & 0x03FFFFFFu);
  std::memcpy(from, &branch, sizeof(branch));
#else
  // E9 measures from the end of the instruction, not its start.
  const intptr_t delta = reinterpret_cast<intptr_t>(landing) -
                         (reinterpret_cast<intptr_t>(from) + static_cast<intptr_t>(kNearJump));
  unsigned char branch[kNearJump] = {0xE9};
  const int32_t relative = static_cast<int32_t>(delta);
  std::memcpy(branch + 1, &relative, sizeof(relative));
  std::memcpy(from, branch, sizeof(branch));
#endif

  __builtin___clear_cache(static_cast<char*>(from), static_cast<char*>(from) + kNearJump);

  return true;
#endif
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
