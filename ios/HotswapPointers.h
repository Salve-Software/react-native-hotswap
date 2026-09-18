#pragma once

#include <stddef.h>

#ifdef __cplusplus
extern "C" {
#endif

/** Repoints function pointers already stored in memory, which is what reaches a vtable. */
size_t HotswapPatchPointers(const char *path);

#ifdef __cplusplus
}
#endif
