package com.hotswap

import android.util.Log
import com.facebook.react.ReactPackage
import java.nio.ByteBuffer

internal object HotswapGenerations {

  private const val TAG = "Hotswap"

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
      host.reload("hotswap published a generation")
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
