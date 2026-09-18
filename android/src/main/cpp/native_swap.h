#pragma once

#include <string>
#include <vector>

/** One function the patch redefines, with the room its original has for a jump. */
struct NativeSymbol {
  std::string name;
  uint32_t size;
};

/** Loads a freshly compiled library and points the originals at what it defines. */
unsigned char hotswapLoadNative(const std::string& filesDir,
                                const std::vector<unsigned char>& image,
                                const std::vector<NativeSymbol>& symbols);
