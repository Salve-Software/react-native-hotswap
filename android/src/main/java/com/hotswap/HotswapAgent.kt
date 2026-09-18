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
  private const val EXTRACTED_LINK = "hotswap-agent.so"
  private const val APK_LINK = "hotswap-base.apk"
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

    val path = agentPath(context) ?: return
    val options = "port=$PORT,files=${context.filesDir.absolutePath}"

    runCatching { Debug.attachJvmtiAgent(path, options, javaClass.classLoader) }
      .onSuccess { Log.i(TAG, "agent attached from $path") }
      .onFailure { Log.w(TAG, "could not attach the agent", it) }
  }

  private fun agentPath(context: Context): String? {
    val extracted = File(context.applicationInfo.nativeLibraryDir, LIBRARY)

    return if (extracted.exists()) {
      linkWithoutEquals(context, extracted.absolutePath, EXTRACTED_LINK)
    } else {
      entryInsideApk(context)
    }
  }

  private fun entryInsideApk(context: Context): String? {
    val abi = Build.SUPPORTED_ABIS.firstOrNull() ?: return null
    val apk = linkWithoutEquals(context, context.applicationInfo.sourceDir, APK_LINK)
      ?: return null

    return "$apk!/lib/$abi/$LIBRARY"
  }

  private fun linkWithoutEquals(context: Context, target: String, name: String): String? {
    val link = File(context.filesDir, name)

    runCatching { Os.remove(link.absolutePath) }

    return runCatching {
      Os.symlink(target, link.absolutePath)
      link.absolutePath
    }
      .onFailure { Log.w(TAG, "could not link $target", it) }
      .getOrNull()
  }

  private fun Context.isDebuggable(): Boolean =
    applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE != 0
}
