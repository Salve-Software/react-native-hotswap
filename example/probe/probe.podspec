Pod::Spec.new do |s|
  s.name         = "probe"
  s.version      = "0.0.1"
  s.summary      = "Swap targets for react-native-hotswap"
  s.homepage     = "https://github.com/Salve-Software/react-native-hotswap"
  s.license      = "MIT"
  s.authors      = "Salve Software"
  s.platforms    = { :ios => "15.1" }
  s.source       = { :git => "https://github.com/Salve-Software/react-native-hotswap.git" }

  s.source_files = ["ios/**/*.{swift,m,mm,h}", "cpp/**/*.{hpp,cpp}"]

  # A C++ header in the umbrella is compiled as Objective-C, where constexpr and virtual are
  # not words. Keeping it private leaves it out of the umbrella and in the search path.
  s.private_header_files = "cpp/**/*.hpp"
  s.pod_target_xcconfig = { "CLANG_CXX_LANGUAGE_STANDARD" => "c++17" }

  s.dependency "React-Core"

  install_modules_dependencies(s)
end
