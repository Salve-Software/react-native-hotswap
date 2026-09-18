package com.hotswap

import android.content.Context
import java.io.File

/** Temporary: picks up a generation dropped into files/, until the socket carries it. */
internal object HotswapDrop {

  private var seen = 0L

  fun watch(context: Context) {
    Thread {
      while (true) {
        val dex = File(context.filesDir, "generation.dex")
        val names = File(context.filesDir, "generation.txt")

        if (dex.exists() && names.exists() && dex.lastModified() != seen) {
          seen = dex.lastModified()
          HotswapGenerations.publish(dex, names.readLines().filter { it.isNotBlank() })
        }

        Thread.sleep(500)
      }
    }
      .start()
  }
}
