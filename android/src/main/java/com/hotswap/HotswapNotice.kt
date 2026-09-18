package com.hotswap

import android.app.Activity
import android.app.Application
import android.content.Context
import android.content.pm.ApplicationInfo
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.Gravity
import android.view.ViewGroup
import android.widget.FrameLayout
import android.widget.TextView

/** Shows a short banner over whatever the app is drawing, the way Metro does for JavaScript. */
internal object HotswapNotice {

  private const val HOLD = 1400L
  private const val FADE = 160L
  private const val TOP_DP = 48
  private const val PADDING_DP = 12

  private val main = Handler(Looper.getMainLooper())

  private var host: Activity? = null
  private var banner: TextView? = null

  fun install(context: Context) {
    val application = context.applicationContext as? Application ?: return
    if (application.applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE == 0) return

    application.registerActivityLifecycleCallbacks(Tracking)
  }

  @JvmStatic
  fun show(text: String) {
    main.post { draw(text) }
  }

  private fun draw(text: String) {
    val activity = host ?: return
    val root = activity.window?.decorView as? ViewGroup ?: return
    val view = banner?.takeIf { it.parent === root } ?: attach(activity, root)

    banner = view
    view.text = text

    main.removeCallbacksAndMessages(null)
    view.animate().cancel()
    view.alpha = 0f
    view.animate().alpha(1f).setDuration(FADE).start()

    main.postDelayed({ view.animate().alpha(0f).setDuration(FADE).start() }, HOLD)
  }

  private fun attach(activity: Activity, root: ViewGroup): TextView {
    val density = activity.resources.displayMetrics.density
    val padding = (PADDING_DP * density).toInt()

    val view = TextView(activity).apply {
      setTextColor(Color.WHITE)
      textSize = 12f
      gravity = Gravity.CENTER
      setPadding(padding, padding / 2, padding, padding / 2)
      background = GradientDrawable().apply {
        cornerRadius = padding * 1.5f
        setColor(Color.parseColor("#DD1F1F1F"))
      }
      elevation = density * 8
    }

    root.addView(
      view,
      FrameLayout.LayoutParams(
        FrameLayout.LayoutParams.WRAP_CONTENT,
        FrameLayout.LayoutParams.WRAP_CONTENT,
        Gravity.TOP or Gravity.CENTER_HORIZONTAL,
      ).apply { topMargin = (TOP_DP * density).toInt() },
    )

    return view
  }

  private object Tracking : Application.ActivityLifecycleCallbacks {
    override fun onActivityResumed(activity: Activity) {
      host = activity
    }

    override fun onActivityDestroyed(activity: Activity) {
      if (host === activity) host = null
    }

    override fun onActivityCreated(activity: Activity, state: Bundle?) = Unit

    override fun onActivityStarted(activity: Activity) = Unit

    override fun onActivityPaused(activity: Activity) = Unit

    override fun onActivityStopped(activity: Activity) = Unit

    override fun onActivitySaveInstanceState(activity: Activity, state: Bundle) = Unit
  }
}
