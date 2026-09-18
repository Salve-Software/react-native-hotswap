import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

/** Derives what to compile and where, overridable by hotswap.config.json. */
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

  for (const key of ['watch', 'project', 'classes', 'abort']) {
    if (overrides[key]) overrides[key] = resolve(root, overrides[key])
  }

  return { ...defaults, ...overrides }
}

/** Finds the gradle wrapper that owns the app. */
function findGradle(root) {
  const candidates = ['example/android', 'android', '../android']

  for (const candidate of candidates) {
    const path = resolve(root, candidate)
    if (existsSync(join(path, 'gradlew'))) return path
  }

  throw new Error('no gradlew found; set "project" in hotswap.config.json')
}
