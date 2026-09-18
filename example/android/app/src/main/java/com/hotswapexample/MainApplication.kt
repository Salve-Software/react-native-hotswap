package com.hotswapexample

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.hotswap.HotswapReactHost

class MainApplication : Application(), ReactApplication {

  // The one line hotswap needs: the package list is read again for every React instance,
  // so a reload can be built from a generation rather than from the apk.
  override val reactHost: ReactHost by lazy {
    HotswapReactHost.create(applicationContext) { PackageList(this).packages }
  }

  override fun onCreate() {
    super.onCreate()
    loadReactNative(this)
  }
}
