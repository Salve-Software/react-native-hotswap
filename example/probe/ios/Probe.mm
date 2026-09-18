#import <ProbeSpec/ProbeSpec.h>
#import <objc/message.h>

#import "Probe.h"

extern "C" void *HotswapClassNamed(const char *name);

/** A TurboModule React Native resolves through its delegate, which is where hotswap answers. */
@interface Probe () <NativeProbeSpec>
@end

@implementation Probe

+ (NSString *)moduleName {
  return @"Probe";
}

+ (BOOL)requiresMainQueueSetup {
  return NO;
}

// The spec has to be Objective-C++, and a generation compiles Swift, so the logic lives in a
// Swift class this asks hotswap for.
- (NSString *)origin {
  Class values = (__bridge Class)HotswapClassNamed("ProbeValues");
  if (values == nil) return @"apk";

  long (*call)(id, SEL) = (long (*)(id, SEL))objc_msgSend;

  return [NSString stringWithFormat:@"generation (%ld)", call([[values alloc] init], @selector(value))];
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params {
  return std::make_shared<facebook::react::NativeProbeSpecJSI>(params);
}

@end
