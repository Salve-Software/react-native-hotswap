package com.hotswap

import com.facebook.react.ReactPackage
import dalvik.system.InMemoryDexClassLoader
import java.io.File
import java.nio.ByteBuffer

/** One build of the module's own classes, loaded from its dex rather than from the apk. */
internal class HotswapGeneration(
  dex: File,
  private val packageNames: List<String>,
  shared: List<String>,
) {

  private val owned: List<String> = packageNames.map { it.substringBeforeLast('.') + "." }

  private val loader: ClassLoader =
    InMemoryDexClassLoader(
      ByteBuffer.wrap(dex.readBytes()),
      Filtering(javaClass.classLoader!!, owned, shared),
    )

  fun packages(): List<ReactPackage> =
    packageNames.map { loader.loadClass(it).getDeclaredConstructor().newInstance() as ReactPackage }

  fun owns(pkg: ReactPackage): Boolean =
    owned.any { pkg.javaClass.name.startsWith(it) }
}

/**
 * Hands the generation everything the app has except what the generation owns.
 *
 * A dex loader asks its parent first, and the module is also in the apk, so without this the
 * apk copy answers and the generation is never reached.
 */
private class Filtering(
  private val app: ClassLoader,
  private val owned: List<String>,
  private val shared: List<String>,
) : ClassLoader(null) {

  override fun loadClass(name: String, resolve: Boolean): Class<*> {
    // A .so belongs to the class loader that loaded it, so a class calling System.loadLibrary
    // cannot be owned by a generation: the second loader is refused and the app goes down.
    if (name in shared) return app.loadClass(name)
    if (owned.any { name.startsWith(it) }) throw ClassNotFoundException(name)

    return app.loadClass(name)
  }
}
