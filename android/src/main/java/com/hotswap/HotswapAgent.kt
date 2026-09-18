package com.hotswap

import android.content.Context
import android.content.pm.ApplicationInfo
import android.os.Build
import android.os.Debug
import android.system.Os
import android.util.Log
import java.io.File

/** Attaches the JVMTI agent once, on a debuggable build only. */
internal object HotswapAgent {

  private const val TAG = "Hotswap"
  private const val LIBRARY = "libhotswap.so"
  private const val LINK = "hotswap-agent.so"
  private const val PORT = 8099

  private var attached = false

  fun attach(context: Context) {
    if (attached) return
    attached = true

    if (!context.isDebuggable()) return

    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.P) {
      Log.w(TAG, "attachJvmtiAgent needs API 28; hot swapping is off here")
      return
    }

    val agent = File(context.applicationInfo.nativeLibraryDir, LIBRARY)
    if (!agent.exists()) {
      Log.w(TAG, "agent missing at ${agent.absolutePath}; is useLegacyPackaging on?")
      return
    }

    val path = agent.linkWithoutEquals(context) ?: return

    runCatching { Debug.attachJvmtiAgent(path, "port=$PORT", javaClass.classLoader) }
      .onSuccess { Log.i(TAG, "agent attached from $path") }
      .onFailure { Log.w(TAG, "could not attach the agent", it) }
  }

  /** Debug.attachJvmtiAgent rejects paths containing '=', which every install path has. */
  private fun File.linkWithoutEquals(context: Context): String? {
    val link = File(context.filesDir, LINK)

    runCatching { Os.remove(link.absolutePath) }

    return runCatching {
      Os.symlink(absolutePath, link.absolutePath)
      link.absolutePath
    }.onFailure { Log.w(TAG, "could not link the agent", it) }.getOrNull()
  }

  private fun Context.isDebuggable(): Boolean =
    applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE != 0
}
