import { relative } from 'node:path';
import { buildDylib } from './build-dylib.js';
import { sendImage } from './send-image.js';

/** Recompiles one Swift file into a dylib and loads it into the running app. */
export async function swapSwift(path, config) {
  const started = Date.now();
  const name = relative(config.root, path);

  try {
    const dylib = buildDylib(path, config);
    const error = await sendImage(dylib, config.iosPort);
    const took = Date.now() - started;

    console.log(
      error === 0 ? `  ✅ ${name}  ${took}ms` : `  ❌ ${name}  dlopen failed  ${took}ms`,
    );

    return error === 0;
  } catch (cause) {
    console.log(`  ❌ ${name}  ${cause.message.split('\n')[0]}`);

    return false;
  }
}
