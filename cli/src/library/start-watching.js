import { execFileSync } from 'node:child_process'
import { relative } from 'node:path'
import { buildDex } from './build-dex.js'
import { loadConfig } from './load-config.js'
import { resolveClassName } from './resolve-class-name.js'
import { sendRedefinition } from './send-redefinition.js'
import { watchKotlin } from './watch-kotlin.js'

/** Watches the module's Kotlin and swaps each saved file into the running app. */
export function startWatching(root) {
  const config = loadConfig(root)

  execFileSync('adb', ['forward', `tcp:${config.port}`, `tcp:${config.port}`], {
    stdio: 'ignore',
  })

  console.log(
    `hotswap  watching ${relative(root, config.watch)}  →  127.0.0.1:${config.port}`,
  )

  watchKotlin(config.watch, (path) => swap(path, root, config))

  return config
}

async function swap(path, root, config) {
  const started = Date.now()
  const name = relative(root, path)

  try {
    const className = resolveClassName(path)
    const { dex, classCount } = buildDex({ className, ...config })
    const error = await sendRedefinition({ className, dex }, config.port)
    const took = Date.now() - started
    const extra = classCount > 1 ? ` +${classCount - 1}` : ''

    console.log(
      error === 0
        ? `  ✅ ${name}${extra}  ${took}ms`
        : `  ❌ ${name}  jvmtiError ${error}  ${took}ms`,
    )
  } catch (cause) {
    console.log(`  ❌ ${name}  ${cause.message.split('\n')[0]}`)
  }
}
