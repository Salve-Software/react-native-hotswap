package com.probe

import android.util.Log

internal object ProbeReporter {

  private var started = false

  fun start() {
    if (started) return
    started = true

    Thread {
      while (true) {
        runCatching {
          Log.i(
            "Probe",
            "kotlin=${ProbeValues.value()} cpp=${ProbeNative.cppValue()} shape=${ProbeNative.cppShape()}",
          )
        }
          .onFailure { Log.e("Probe", "reporter failed", it) }
        Thread.sleep(1000)
      }
    }
      .start()
  }
}
