const { existsSync } = require('node:fs')
const { join, resolve } = require('node:path')

let started = false

/** Starts the Kotlin watcher alongside Metro, so `react-native start` is the only process. */
function withHotswap(config, options = {}) {
  if (started || process.env.HOTSWAP === '0') return config
  started = true

  const root = options.root ?? findModuleRoot(process.cwd())

  import('./cli/src/library/start-watching.js')
    .then(({ startWatching }) => startWatching(root))
    .catch((cause) => console.log(`hotswap  off: ${cause.message.split('\n')[0]}`))

  return config
}

/** Metro usually runs from the example app, one level below the module itself. */
function findModuleRoot(from) {
  for (const candidate of [from, resolve(from, '..')]) {
    if (existsSync(join(candidate, 'android/src/main/java'))) return candidate
  }

  throw new Error('no android/src/main/java found; pass { root } to withHotswap')
}

module.exports = { withHotswap }
