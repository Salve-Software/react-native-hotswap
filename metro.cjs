let started = false;

/** Starts the watcher alongside Metro, so `react-native start` is the only process. */
function withHotswap(config, options = {}) {
  if (started || process.env.HOTSWAP === '0') return config;
  started = true;

  Promise.all([
    import('./cli/src/library/load-config.js'),
    import('./cli/src/library/start-watching.js'),
    import('./cli/src/library/find-module-root.js'),
  ])
    .then(([{ loadConfig }, { startWatching }, { findModuleRoot }]) =>
      startWatching(loadConfig(options.root ?? findModuleRoot(process.cwd()))),
    )
    .catch((cause) => console.log(`hotswap  off: ${cause.message.split('\n')[0]}`));

  return config;
}

module.exports = { withHotswap };
