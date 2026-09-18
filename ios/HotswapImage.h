#pragma once

#include <mach-o/loader.h>
#include <mach-o/nlist.h>
#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

/** One image, as dyld mapped it. */
struct HotswapImage {
  const mach_header_64 *header;
  intptr_t slide;
};

/** An image's symbol table, already offset to where the image was mapped. */
struct HotswapSymbols {
  const nlist_64 *entries;
  uint32_t count;
  const char *strings;
  const uint32_t *indirect;
};

/** Finds the image dyld mapped for a path, or returns false when it is not loaded. */
bool HotswapFindImage(const char *path, HotswapImage &into);

bool HotswapReadSymbols(const HotswapImage &image, HotswapSymbols &into);

void HotswapEachAppImage(const mach_header_64 *except, void (^body)(const HotswapImage &));

void HotswapEachDataSection(const HotswapImage &image, void (^body)(const section_64 *));

/** Lifts the read-only protection dyld leaves on __DATA_CONST. */
bool HotswapMakeWritable(void *address, size_t size);

/** The name of a symbol this image defines, or null for debug entries and imports. */
const char *HotswapDefinedName(const HotswapSymbols &symbols, const nlist_64 &symbol);

bool HotswapIsCode(const HotswapImage &image, const nlist_64 &symbol);
