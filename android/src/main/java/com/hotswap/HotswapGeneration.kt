package com.hotswap

import com.facebook.react.ReactPackage
import dalvik.system.InMemoryDexClassLoader
import java.nio.ByteBuffer

/** One build of the module's own classes, loaded from its dex rather than from the apk. */
internal class HotswapGeneration(
  dexes: List<ByteBuffer>,
  private val packageNames: List<String>,
  shared: List<String>,
) {

  private val owned: List<String> = packageNames.map { it.substringBeforeLast('.') + "." }

  private val loader: ClassLoader =
    InMemoryDexClassLoader(
      dexes.toTypedArray(),
      Filtering(javaClass.classLoader!!, owned, shared),
    )

  fun packages(): List<ReactPackage> =
    packageNames.map { loader.loadClass(it).getDeclaredConstructor().newInstance() as ReactPackage }

  fun owns(pkg: ReactPackage): Boolean =
    owned.any { pkg.javaClass.name.startsWith(it) }
}

/** A dex loader asks its parent first, so the parent refuses what the generation owns. */
private class Filtering(
  private val app: ClassLoader,
  private val owned: List<String>,
  private val shared: List<String>,
) : ClassLoader(null) {

  override fun loadClass(name: String, resolve: Boolean): Class<*> {
    if (name in shared) return app.loadClass(name)
    if (owned.any { name.startsWith(it) }) throw ClassNotFoundException(name)

    return app.loadClass(name)
  }
}
