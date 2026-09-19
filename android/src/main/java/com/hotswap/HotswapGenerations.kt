package com.hotswap

import android.util.Log
import com.facebook.react.ReactPackage
import java.nio.ByteBuffer
import java.util.concurrent.TimeUnit

internal object HotswapGenerations {

  private const val TAG = "Hotswap"

  private const val RELOAD_SECONDS = 60L

  @Volatile private var current: HotswapGeneration? = null

  @JvmStatic
  fun publish(dexes: Array<ByteArray>, manifest: Array<String>): Boolean =
    runCatching {
      val packageNames = manifest.filterNot { it.startsWith("!") }
      val shared = manifest.filter { it.startsWith("!") }.map { it.drop(1) }

      current =
        HotswapGeneration(dexes.map { ByteBuffer.wrap(it) }, packageNames, shared)
      Log.i(TAG, "published a generation providing ${packageNames.size} package(s)")

      HotswapPackages.refresh()

      val host =
        HotswapReactHost.running ?: error("no React host to reload; is this a ReactApplication?")

      // `reload` hands back a task and returns. Answering before it finishes says a
      // generation is running when the instance is still the old one, and whoever asked
      // goes looking for new code that is not there yet. This is a socket thread, not the
      // main one, so waiting here leaves the reload the thread it needs.
      val reloaded = host.reload("hotswap published a generation")

      if (!reloaded.waitForCompletion(RELOAD_SECONDS, TimeUnit.SECONDS)) {
        error("the React host did not finish reloading in ${RELOAD_SECONDS}s")
      }

      reloaded.getError()?.let { throw it }
    }
      .onFailure { Log.e(TAG, "could not publish the generation", it) }
      .isSuccess

  fun merge(base: List<ReactPackage>): List<ReactPackage> {
    val generation = current ?: return base

    return runCatching { base.filterNot(generation::owns) + generation.packages() }
      .onFailure { Log.e(TAG, "falling back to the apk's packages", it) }
      .getOrDefault(base)
  }
}
