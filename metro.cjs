const { existsSync } = require('node:fs');
const { join } = require('node:path');

let started = false;

/** Starts the watcher alongside Metro, so `react-native start` is the only process. */
function withHotswap(config, options = {}) {
  if (started || process.env.HOTSWAP === '0') return config;
  started = true;

  // The package ships compiled, but a checkout used straight from git has no lib yet, and
  // a missing directory reads as a broken tool rather than a build that has not run.
  if (!existsSync(join(__dirname, 'lib'))) {
    console.log(
      'hotswap  off: not built yet, run `bun run build` in react-native-hotswap',
    );

    return config;
  }

  import('./lib/index.js')
    .then(({ Hotswap, findModuleRoot }) => {
      new Hotswap(options.root ?? findModuleRoot(process.cwd())).watch();
    })
    .catch((cause) => console.log(`hotswap  off: ${cause.message.split('\n')[0]}`));

  return config;
}

module.exports = { withHotswap };
