#import <Foundation/Foundation.h>
#import <React/RCTReloadCommand.h>
#import <dlfcn.h>

#import "HotswapGenerations.h"

namespace {

using Factory = void *(*)(const char *);

void *gGeneration = nullptr;

}  // namespace

bool HotswapPublishGeneration(const char *path) {
  void *image = dlopen(path, RTLD_NOW | RTLD_LOCAL);

  if (image == nullptr) {
    NSLog(@"[Hotswap] generation would not load: %s", dlerror());
    return false;
  }

  if (dlsym(image, "hotswapClassNamed") == nullptr) {
    NSLog(@"[Hotswap] generation exposes no classes; was the factory generated?");
    return false;
  }

  gGeneration = image;
  NSLog(@"[Hotswap] published a generation, reloading");

  dispatch_async(dispatch_get_main_queue(), ^{
    RCTTriggerReloadCommandListeners(@"hotswap published a generation");
  });

  return true;
}

void *HotswapClassNamed(const char *name) {
  if (gGeneration == nullptr) return nullptr;

  auto factory = reinterpret_cast<Factory>(dlsym(gGeneration, "hotswapClassNamed"));

  return factory == nullptr ? nullptr : factory(name);
}

@implementation Hotswap

+ (Class)moduleClassFromName:(const char *)name {
  return (__bridge Class)HotswapClassNamed(name);
}

@end
