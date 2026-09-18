package com.nitrohot

import android.content.Context
import android.content.pm.ApplicationInfo
import android.os.Build
import android.os.Debug
import android.util.Log
import androidx.startup.Initializer
import java.io.File

/** Attaches the JVMTI agent on app start, so installing the package is the whole setup. */
class NitroHotInitializer : Initializer<Unit> {

  override fun create(context: Context) {
    if (!context.isDebuggable()) return

    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.P) {
      Log.w(TAG, "attachJvmtiAgent needs API 28; hot reload is off on this device")
      return
    }

    val agent = File(context.applicationInfo.nativeLibraryDir, AGENT)
    if (!agent.exists()) {
      Log.w(TAG, "agent missing at ${agent.absolutePath}")
      return
    }

    runCatching { Debug.attachJvmtiAgent(agent.absolutePath, "port=$PORT", javaClass.classLoader) }
      .onFailure { Log.w(TAG, "could not attach the agent", it) }
  }

  override fun dependencies(): List<Class<out Initializer<*>>> = emptyList()

  private fun Context.isDebuggable(): Boolean =
    applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE != 0

  private companion object {
    const val TAG = "NitroHot"
    const val AGENT = "libnitrohot.so"
    const val PORT = 8099
  }
}
