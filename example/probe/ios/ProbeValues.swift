import Foundation

/** The Swift swap target. Change what it returns and save. */
class ProbeValues {

  func value() -> Int {
    return 1
  }
}

@_cdecl("probeSwiftValue")
func probeSwiftValue() -> Int {
  return ProbeValues().value()
}
