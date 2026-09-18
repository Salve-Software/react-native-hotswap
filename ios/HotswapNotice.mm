#import "HotswapNotice.h"

#import <UIKit/UIKit.h>

static const NSTimeInterval kHold = 1.4;
static const NSTimeInterval kFade = 0.16;
static const CGFloat kTop = 60;
static const CGFloat kPadding = 12;
static const CGFloat kHeight = 28;

static UIWindow *gWindow;
static UILabel *gLabel;
static uint64_t gShown;

static UIWindowScene *activeScene(void) {
  for (UIScene *candidate in UIApplication.sharedApplication.connectedScenes) {
    if ([candidate isKindOfClass:UIWindowScene.class] &&
        candidate.activationState == UISceneActivationStateForegroundActive) {
      return (UIWindowScene *)candidate;
    }
  }

  return nil;
}

static void buildWindow(UIWindowScene *scene) {
  gLabel = [UILabel new];
  gLabel.textColor = UIColor.whiteColor;
  gLabel.font = [UIFont systemFontOfSize:12 weight:UIFontWeightMedium];
  gLabel.textAlignment = NSTextAlignmentCenter;
  gLabel.backgroundColor = [UIColor colorWithWhite:0.12 alpha:0.87];
  gLabel.layer.cornerRadius = kHeight / 2;
  gLabel.clipsToBounds = YES;

  UIViewController *holder = [UIViewController new];
  holder.view = gLabel;

  gWindow = [[UIWindow alloc] initWithWindowScene:scene];
  gWindow.windowLevel = UIWindowLevelAlert + 1;
  gWindow.backgroundColor = UIColor.clearColor;
  gWindow.userInteractionEnabled = NO;
  gWindow.rootViewController = holder;

  // Showing it without making it key, so the app keeps the keyboard and every touch.
  gWindow.hidden = NO;
}

static void drawNotice(NSString *text) {
  UIWindowScene *scene = activeScene();
  if (scene == nil) return;

  if (gWindow.windowScene != scene) buildWindow(scene);

  gLabel.text = text;

  const CGRect bounds = scene.coordinateSpace.bounds;
  const CGFloat wanted = [gLabel sizeThatFits:CGSizeZero].width + kPadding * 2;
  const CGFloat width = MIN(wanted, bounds.size.width - kPadding * 2);

  gWindow.frame = CGRectMake((bounds.size.width - width) / 2, kTop, width, kHeight);
  gWindow.alpha = 0;
  [UIView animateWithDuration:kFade animations:^{ gWindow.alpha = 1; }];

  const uint64_t mine = ++gShown;
  dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(kHold * NSEC_PER_SEC)),
                 dispatch_get_main_queue(), ^{
                   if (gShown != mine) return;
                   [UIView animateWithDuration:kFade animations:^{ gWindow.alpha = 0; }];
                 });
}

void HotswapShowNotice(NSString *text) {
  dispatch_async(dispatch_get_main_queue(), ^{ drawNotice(text); });
}
