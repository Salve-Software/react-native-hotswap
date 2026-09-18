#pragma once

#include <stdbool.h>
#include <stddef.h>

#ifdef __cplusplus
extern "C" {
#endif

/** Points existing call sites at the implementations the new image exports. */
size_t HotswapRebindSymbols(void *replacementImage, const char *path);

/** Whether the image carries Swift dynamic replacements, which the runtime applies itself. */
bool HotswapHasReplacements(const char *path);

#ifdef __cplusplus
}
#endif
