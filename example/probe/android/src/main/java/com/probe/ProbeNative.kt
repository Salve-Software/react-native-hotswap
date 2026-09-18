package com.probe

internal object ProbeNative {

  init {
    System.loadLibrary("probe")
  }

  external fun cppValue(): Int

  external fun cppShape(): Int
}
