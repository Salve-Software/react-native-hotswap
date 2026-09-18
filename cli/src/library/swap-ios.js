import { relative } from 'node:path';
import { buildDylib } from './build-dylib.js';
import { sendImage } from './send-image.js';

/** Recompiles one Swift or C++ file into a dylib and loads it into the running app. */
export async function swapIos(path, config) {
  const started = Date.now();
  const name = relative(config.root, path);

  try {
    const dylib = buildDylib(path, config);
    const error = await sendImage(dylib, config.iosPort);
    const took = Date.now() - started;

    const reason = error === 1 ? 'dlopen failed' : 'loaded but replaced nothing';

    console.log(
      error === 0 ? `  ✅ ${name}  ${took}ms` : `  ❌ ${name}  ${reason}  ${took}ms`,
    );

    return error === 0;
  } catch (cause) {
    console.log(`  ❌ ${name}  ${cause.message.split('\n')[0]}`);

    return false;
  }
}
