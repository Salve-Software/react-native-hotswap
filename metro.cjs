const { existsSync } = require('node:fs');
const { join } = require('node:path');

let started = false;

function withHotswap(config, options = {}) {
  if (started || process.env.HOTSWAP === '0') return config;
  started = true;

  // A checkout used straight from git has no lib yet, which reads as a broken tool.
  if (!existsSync(join(__dirname, 'lib'))) {
    console.log(
      'hotswap  off: not built yet, run `bun run build` in react-native-hotswap',
    );

    return config;
  }

  import('./lib/index.js')
    .then(({ Hotswap, findModuleRoot }) => {
      const roots = options.roots ?? [options.root ?? findModuleRoot(process.cwd())];

      for (const root of roots) new Hotswap(root).watch();
    })
    .catch((cause) => console.log(`hotswap  off: ${cause.message.split('\n')[0]}`));

  return config;
}

module.exports = { withHotswap };
