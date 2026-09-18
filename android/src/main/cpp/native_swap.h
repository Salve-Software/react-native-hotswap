#pragma once

#include <string>
#include <vector>

/** One function the patch redefines, with the room its original has for a jump. */
struct NativeSymbol {
  std::string name;
  uint32_t size;
};

unsigned char hotswapLoadNative(const std::string& filesDir,
                                const std::vector<unsigned char>& image,
                                const std::vector<NativeSymbol>& symbols);
