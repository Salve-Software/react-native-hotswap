package com.probe

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class ProbePackage : ReactPackage {

  override fun createNativeModules(context: ReactApplicationContext): List<NativeModule> {
    ProbeReporter.start()

    return emptyList()
  }

  override fun createViewManagers(context: ReactApplicationContext): List<ViewManager<*, *>> =
    emptyList()
}
