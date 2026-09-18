package com.hotswapexample

import android.util.Log

internal object AppReporter {

  private var started = false

  fun start() {
    if (started) return
    started = true

    Thread {
      while (true) {
        Log.i("AppProbe", "app=${AppValues.value()}")
        Thread.sleep(1000)
      }
    }
      .start()
  }
}
