#import <Foundation/Foundation.h>
#import <string>
#import <unordered_map>

#import "HotswapImage.h"
#import "HotswapPointers.h"

namespace {

using Addresses = std::unordered_map<const void *, const void *>;
using ByName = std::unordered_map<std::string, const void *>;

ByName definedBy(const HotswapImage &image) {
  ByName found;
  HotswapSymbols symbols{};
  if (!HotswapReadSymbols(image, symbols)) return found;

  for (uint32_t i = 0; i < symbols.count; i++) {
    const nlist_64 &symbol = symbols.entries[i];
    const char *name = HotswapDefinedName(symbols, symbol);
    if (name == nullptr || !HotswapIsCode(image, symbol)) continue;

    found[name] = (const void *)(symbol.n_value + image.slide);
  }

  return found;
}

// What the last swap put in place for a symbol. A vtable slot patched once no longer holds
// the address the app's symbol table reports, so without this a second swap of the same
// method finds nothing to overwrite and the first swap's code keeps running.
ByName installed;

/** Pairs each address the app is still running with the one that replaces it. */
Addresses supersededBy(const ByName &fresh, const mach_header_64 *replacement) {
  __block Addresses found;

  for (const auto &[name, address] : fresh) {
    const auto previous = installed.find(name);
    if (previous != installed.end() && previous->second != address) {
      found[previous->second] = address;
    }
  }

  HotswapEachAppImage(replacement, ^(const HotswapImage &image) {
    HotswapSymbols symbols{};
    if (!HotswapReadSymbols(image, symbols)) return;

    for (uint32_t i = 0; i < symbols.count; i++) {
      const nlist_64 &symbol = symbols.entries[i];
      const char *name = HotswapDefinedName(symbols, symbol);
      if (name == nullptr) continue;

      const auto replaced = fresh.find(name);
      if (replaced == fresh.end() || !HotswapIsCode(image, symbol)) continue;

      const void *was = (const void *)(symbol.n_value + image.slide);
      if (was != replaced->second) found[was] = replaced->second;
    }
  });

  return found;
}

size_t patchSection(const section_64 *section,
                    const HotswapImage &image,
                    const Addresses &superseded) {
  auto **slots = (void **)(image.slide + section->addr);
  const size_t count = section->size / sizeof(void *);
  size_t patched = 0;

  for (size_t i = 0; i < count; i++) {
    const auto replacement = superseded.find(slots[i]);
    if (replacement == superseded.end()) continue;
    if (!HotswapMakeWritable(&slots[i], sizeof(void *))) continue;

    slots[i] = (void *)replacement->second;
    patched++;
  }

  return patched;
}

}  // namespace

size_t HotswapPatchPointers(const char *path) {
  HotswapImage replacement{};
  if (!HotswapFindImage(path, replacement)) return 0;

  // A virtual call reads its target out of the vtable, which holds the address directly and
  // names no symbol, so rebinding never sees it. The old address has to be found in memory
  // and overwritten wherever it was stored.
  const ByName fresh = definedBy(replacement);
  const Addresses superseded = supersededBy(fresh, replacement.header);

  for (const auto &[name, address] : fresh) installed[name] = address;

  if (superseded.empty()) return 0;

  __block size_t patched = 0;

  HotswapEachAppImage(replacement.header, ^(const HotswapImage &image) {
    HotswapEachDataSection(image, ^(const section_64 *section) {
      patched += patchSection(section, image, superseded);
    });
  });

  return patched;
}
