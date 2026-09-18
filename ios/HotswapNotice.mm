#import "HotswapNotice.h"

#import <UIKit/UIKit.h>

static const NSTimeInterval kHold = 1.6;
static const NSTimeInterval kFade = 0.18;
static const CGFloat kTop = 64;
static const CGFloat kPadding = 14;
static const CGFloat kHeight = 32;

static UIWindow *gWindow;
static UIView *gCard;
static CAGradientLayer *gGradient;
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

static NSAttributedString *styled(NSString *title, NSString *detail) {
  UIFont *font = [UIFont systemFontOfSize:12.5 weight:UIFontWeightSemibold];
  NSMutableAttributedString *text =
      [[NSMutableAttributedString alloc] initWithString:title
                                            attributes:@{
                                              NSFontAttributeName : font,
                                              NSForegroundColorAttributeName : UIColor.whiteColor
                                            }];

  if (detail.length == 0) return text;

  UIColor *dim = [UIColor colorWithRed:0.78 green:0.77 blue:1 alpha:1];
  [text appendAttributedString:
            [[NSAttributedString alloc]
                initWithString:[@"   " stringByAppendingString:detail]
                    attributes:@{
                      NSFontAttributeName : [UIFont systemFontOfSize:12.5],
                      NSForegroundColorAttributeName : dim
                    }]];

  return text;
}

static void buildWindow(UIWindowScene *scene) {
  gGradient = [CAGradientLayer layer];
  gGradient.colors = @[
    (id)[UIColor colorWithRed:0.486 green:0.361 blue:1 alpha:1].CGColor,
    (id)[UIColor colorWithRed:0.310 green:0.275 blue:0.898 alpha:1].CGColor
  ];
  gGradient.startPoint = CGPointMake(0, 0.5);
  gGradient.endPoint = CGPointMake(1, 0.5);
  gGradient.cornerRadius = kHeight / 2;

  gLabel = [UILabel new];
  gLabel.textAlignment = NSTextAlignmentCenter;

  gCard = [UIView new];
  gCard.backgroundColor = UIColor.clearColor;
  gCard.layer.shadowColor = [UIColor colorWithRed:0.24 green:0.18 blue:0.6 alpha:1].CGColor;
  gCard.layer.shadowOpacity = 0.35;
  gCard.layer.shadowRadius = 10;
  gCard.layer.shadowOffset = CGSizeMake(0, 4);
  [gCard.layer addSublayer:gGradient];
  [gCard addSubview:gLabel];

  UIViewController *holder = [UIViewController new];
  holder.view = gCard;

  gWindow = [[UIWindow alloc] initWithWindowScene:scene];
  gWindow.windowLevel = UIWindowLevelAlert + 1;
  gWindow.backgroundColor = UIColor.clearColor;
  gWindow.userInteractionEnabled = NO;
  gWindow.rootViewController = holder;

  // Showing it without making it key, so the app keeps the keyboard and every touch.
  gWindow.hidden = NO;
}

static void drawNotice(NSString *title, NSString *detail) {
  UIWindowScene *scene = activeScene();
  if (scene == nil) return;

  if (gWindow.windowScene != scene) buildWindow(scene);

  gLabel.attributedText = styled(title, detail);

  const CGRect bounds = scene.coordinateSpace.bounds;
  const CGFloat wanted = [gLabel sizeThatFits:CGSizeZero].width + kPadding * 2;
  const CGFloat width = MIN(wanted, bounds.size.width - kPadding * 2);

  gWindow.frame = CGRectMake((bounds.size.width - width) / 2, kTop, width, kHeight);
  gCard.frame = CGRectMake(0, 0, width, kHeight);
  gGradient.frame = gCard.bounds;
  gLabel.frame = gCard.bounds;

  gWindow.alpha = 0;
  gWindow.transform = CGAffineTransformMakeTranslation(0, -kHeight / 3);
  [UIView animateWithDuration:kFade
                   animations:^{
                     gWindow.alpha = 1;
                     gWindow.transform = CGAffineTransformIdentity;
                   }];

  const uint64_t mine = ++gShown;
  dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(kHold * NSEC_PER_SEC)),
                 dispatch_get_main_queue(), ^{
                   if (gShown != mine) return;
                   [UIView animateWithDuration:kFade animations:^{ gWindow.alpha = 0; }];
                 });
}

void HotswapShowNotice(NSString *title, NSString *detail) {
  dispatch_async(dispatch_get_main_queue(), ^{ drawNotice(title, detail); });
}
