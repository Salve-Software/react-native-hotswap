#import <Foundation/Foundation.h>
#import <os/log.h>
#import <chrono>
#import <thread>

#import "probe.hpp"

extern "C" int probeSwiftValue(void);

@interface ProbeDriver : NSObject
@end

@implementation ProbeDriver

+ (void)load {
  std::thread([] {
    Probe *shared = new Probe();

    while (true) {
      os_log(OS_LOG_DEFAULT, "[Probe] swift=%d cpp=%d shape=%d", (int)probeSwiftValue(),
             probeValue(), shared->shape());
      std::this_thread::sleep_for(std::chrono::seconds(1));
    }
  }).detach();
}

@end
