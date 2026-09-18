require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "RNHotswap"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = package["homepage"]
  s.license      = package["license"]
  s.authors      = package["author"]

  s.platforms    = { :ios => "15.1" }
  s.source       = { :git => "https://github.com/Salve-Software/react-native-hotswap.git", :tag => "#{s.version}" }
  s.source_files = "ios/**/*.{h,m,mm}"

  # Only the delegate hook is meant to be imported. The rest walk Mach-O structures and do
  # not survive being compiled as Objective-C inside the umbrella.
  s.public_header_files = "ios/HotswapGenerations.h"
  s.private_header_files = ["ios/HotswapImage.h", "ios/HotswapPointers.h", "ios/HotswapRebind.h"]
  s.pod_target_xcconfig = {
    "CLANG_CXX_LANGUAGE_STANDARD" => "c++17",
    # Swift in the app has to import this to reach the delegate hook.
    "DEFINES_MODULE" => "YES",
  }

  s.dependency "React-Core"
end
