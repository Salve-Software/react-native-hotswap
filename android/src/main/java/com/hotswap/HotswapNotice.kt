package com.hotswap

import android.app.Activity
import android.app.Application
import android.content.Context
import android.content.pm.ApplicationInfo
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.text.Spannable
import android.text.SpannableStringBuilder
import android.text.style.ForegroundColorSpan
import android.text.style.StyleSpan
import android.view.Gravity
import android.view.ViewGroup
import android.widget.FrameLayout
import android.widget.TextView

/** Shows a short banner over whatever the app is drawing, in hotswap's colours, not React's. */
internal object HotswapNotice {

  private const val HOLD = 1600L
  private const val FADE = 180L
  private const val TOP_DP = 52
  private const val PADDING_DP = 14
  private const val START = "#7C5CFF"
  private const val END = "#4F46E5"
  private const val DETAIL = "#C7C4FF"

  private val main = Handler(Looper.getMainLooper())

  private var host: Activity? = null
  private var banner: TextView? = null

  fun install(context: Context) {
    val application = context.applicationContext as? Application ?: return
    if (application.applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE == 0) return

    application.registerActivityLifecycleCallbacks(Tracking)
  }

  @JvmStatic
  fun show(title: String, detail: String) {
    main.post { draw(title, detail) }
  }

  private fun draw(title: String, detail: String) {
    val activity = host ?: return
    val root = activity.window?.decorView as? ViewGroup ?: return
    val view = banner?.takeIf { it.parent === root } ?: attach(activity, root)

    banner = view
    view.text = styled(title, detail)

    main.removeCallbacksAndMessages(null)
    view.animate().cancel()
    view.alpha = 0f
    view.translationY = -view.height / 3f
    view.animate().alpha(1f).translationY(0f).setDuration(FADE).start()

    main.postDelayed({ view.animate().alpha(0f).setDuration(FADE).start() }, HOLD)
  }

  private fun styled(title: String, detail: String): CharSequence {
    val text = SpannableStringBuilder(title)
    text.setSpan(StyleSpan(Typeface.BOLD), 0, title.length, Spannable.SPAN_EXCLUSIVE_EXCLUSIVE)

    if (detail.isEmpty()) return text

    text.append("   ").append(detail)
    text.setSpan(
      ForegroundColorSpan(Color.parseColor(DETAIL)),
      title.length,
      text.length,
      Spannable.SPAN_EXCLUSIVE_EXCLUSIVE,
    )

    return text
  }

  private fun attach(activity: Activity, root: ViewGroup): TextView {
    val density = activity.resources.displayMetrics.density
    val padding = (PADDING_DP * density).toInt()

    val view = TextView(activity).apply {
      setTextColor(Color.WHITE)
      textSize = 12.5f
      gravity = Gravity.CENTER
      setPadding(padding, padding * 2 / 3, padding, padding * 2 / 3)
      background = GradientDrawable(
        GradientDrawable.Orientation.LEFT_RIGHT,
        intArrayOf(Color.parseColor(START), Color.parseColor(END)),
      ).apply { cornerRadius = padding * 1.6f }
      elevation = density * 10
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
