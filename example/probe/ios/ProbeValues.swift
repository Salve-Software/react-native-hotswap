import Foundation

/** The Swift swap target. Change what it returns and save. */
@objc public class ProbeValues: NSObject {

  @objc public func value() -> Int {
    return 1
  }
}

@_cdecl("probeSwiftValue")
func probeSwiftValue() -> Int {
  return ProbeValues().value()
}
