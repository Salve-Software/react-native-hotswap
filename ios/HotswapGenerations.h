#pragma once

#include <stdbool.h>

#ifdef __cplusplus
extern "C" {
#endif

/** Loads a generation and asks React Native to rebuild its instance from it. */
bool HotswapPublishGeneration(const char *path);

/** The class the current generation exposes under that name, or null. */
void *HotswapClassNamed(const char *name);

#ifdef __cplusplus
}
#endif
