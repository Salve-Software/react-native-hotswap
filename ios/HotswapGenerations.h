#pragma once

#include <stdbool.h>

#ifdef __OBJC__
#import <Foundation/Foundation.h>

/** What a React Native delegate asks before falling back to the app's own classes. */
@interface Hotswap : NSObject

+ (Class)moduleClassFromName:(const char *)name;

@end
#endif

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
