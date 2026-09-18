#pragma once

#include <stddef.h>

#ifdef __cplusplus
extern "C" {
#endif

/** Points existing call sites at the implementations the new image exports. */
size_t HotswapRebindSymbols(void *replacementImage);

#ifdef __cplusplus
}
#endif
