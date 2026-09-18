#import <Foundation/Foundation.h>
#import <objc/message.h>
#import <os/log.h>
#import <chrono>
#import <thread>

#import "probe.hpp"

extern "C" int probeSwiftValue(void);
extern "C" void *HotswapClassNamed(const char *name);

static int swiftValue(void) {
  Class fromGeneration = (__bridge Class)HotswapClassNamed("ProbeValues");
  if (fromGeneration == nil) return probeSwiftValue();

  id instance = [[fromGeneration alloc] init];
  long (*call)(id, SEL) = (long (*)(id, SEL))objc_msgSend;

  return (int)call(instance, @selector(value));
}

@interface ProbeDriver : NSObject
@end

@implementation ProbeDriver

+ (void)load {
  std::thread([] {
    Probe *shared = new Probe();

    while (true) {
      os_log(OS_LOG_DEFAULT, "[Probe] swift=%d cpp=%d shape=%d", swiftValue(), probeValue(),
             shared->shape());
      std::this_thread::sleep_for(std::chrono::seconds(1));
    }
  }).detach();
}

@end
