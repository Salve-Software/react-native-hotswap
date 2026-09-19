package com.hotswap

import android.app.Application
import android.content.Context
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactPackage
import com.facebook.react.ReactPackageTurboModuleManagerDelegate
import com.facebook.react.bridge.JSBundleLoader
import com.facebook.react.common.annotations.UnstableReactNativeAPI
import com.facebook.react.defaults.DefaultComponentsRegistry
import com.facebook.react.defaults.DefaultTurboModuleManagerDelegate
import com.facebook.react.fabric.ComponentFactory
import com.facebook.react.runtime.BindingsInstaller
import com.facebook.react.runtime.JSRuntimeFactory
import com.facebook.react.runtime.ReactHostDelegate
import com.facebook.react.runtime.ReactHostImpl
import com.facebook.react.runtime.hermes.HermesInstance

/** A React host that reads its packages again for every instance it builds. */
@OptIn(UnstableReactNativeAPI::class)
public object HotswapReactHost {

  internal var current: ReactHost? = null
    private set

  internal var application: Application? = null

  internal val running: ReactHost?
    get() = current ?: (application as? ReactApplication)?.reactHost

  @JvmStatic
  public fun create(context: Context, packages: () -> List<ReactPackage>): ReactHost {
    val componentFactory = ComponentFactory()
    DefaultComponentsRegistry.register(componentFactory)

    val host = ReactHostImpl(context, Delegate(context, packages), componentFactory, true, true)
    current = host

    return host
  }
}

@OptIn(UnstableReactNativeAPI::class)
private class Delegate(context: Context, private val packages: () -> List<ReactPackage>) :
  ReactHostDelegate {

  override val jsMainModulePath: String = "index"

  override val bindingsInstaller: BindingsInstaller? = null

  override val jsRuntimeFactory: JSRuntimeFactory = HermesInstance()

  override val jsBundleLoader: JSBundleLoader =
    JSBundleLoader.createAssetLoader(context, "assets://index.android.bundle", true)

  override val turboModuleManagerDelegateBuilder: ReactPackageTurboModuleManagerDelegate.Builder =
    DefaultTurboModuleManagerDelegate.Builder()

  override val reactPackages: List<ReactPackage>
    get() = HotswapGenerations.merge(packages())

  override fun handleInstanceException(error: Exception) {
    throw error
  }
}
