import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

/**
 * Works out where to compile from and what to compile, so the common case needs
 * no configuration. A hotswap.config.json beside package.json overrides any key.
 */
export function loadConfig(root) {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))

  const defaults = {
    port: 8099,
    watch: join(root, 'android/src/main/java'),
    project: findGradle(root),
    task: `:${pkg.name}:compileDebugKotlin`,
    classes: join(root, 'android/build/tmp/kotlin-classes/debug'),
    abort: join(root, 'src/specs'),
  }

  const file = join(root, 'hotswap.config.json')
  const overrides = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {}

  // Paths in the config file read as relative to the module, not to wherever the
  // process happens to be started from — Metro runs out of the example app.
  for (const key of ['watch', 'project', 'classes', 'abort']) {
    if (overrides[key]) overrides[key] = resolve(root, overrides[key])
  }

  return { ...defaults, ...overrides }
}

/**
 * The gradle build that owns the app lives in the example by convention, and in
 * the app itself when the library is consumed directly.
 */
function findGradle(root) {
  const candidates = ['example/android', 'android', '../android']

  for (const candidate of candidates) {
    const path = resolve(root, candidate)
    if (existsSync(join(path, 'gradlew'))) return path
  }

  throw new Error('no gradlew found; set "project" in hotswap.config.json')
}
