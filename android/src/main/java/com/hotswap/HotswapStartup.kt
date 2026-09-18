package com.hotswap

import android.content.ContentProvider
import android.content.ContentValues
import android.database.Cursor
import android.net.Uri

/** Runs before the first Activity is created, which is the only way to see it resume. */
internal class HotswapStartup : ContentProvider() {

  override fun onCreate(): Boolean {
    context?.let { HotswapNotice.install(it) }

    return true
  }

  override fun query(
    uri: Uri,
    projection: Array<String>?,
    selection: String?,
    arguments: Array<String>?,
    order: String?,
  ): Cursor? = null

  override fun getType(uri: Uri): String? = null

  override fun insert(uri: Uri, values: ContentValues?): Uri? = null

  override fun delete(uri: Uri, selection: String?, arguments: Array<String>?): Int = 0

  override fun update(
    uri: Uri,
    values: ContentValues?,
    selection: String?,
    arguments: Array<String>?,
  ): Int = 0
}
