package com.hotswap

import com.facebook.react.ReactPackage

/** A package list React Native keeps reading, for hosts this library does not create. */
public object HotswapPackages {

  private val live = mutableListOf<ReactPackage>()

  private var base: List<ReactPackage>? = null

  @JvmStatic
  public fun of(packages: List<ReactPackage>): MutableList<ReactPackage> {
    live.clear()
    live.addAll(packages)

    return live
  }

  internal fun refresh() {
    val original = base ?: live.toList().also { base = it }

    live.clear()
    live.addAll(HotswapGenerations.merge(original))
  }
}
