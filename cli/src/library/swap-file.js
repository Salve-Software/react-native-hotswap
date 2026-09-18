import { relative } from 'node:path';
import { buildDex } from './build-dex.js';
import { readClassName } from './read-class-name.js';
import { sendRedefinition } from './send-redefinition.js';

/** Swaps one Kotlin file into the running app and reports the outcome. */
export async function swapFile(path, config) {
  const started = Date.now();
  const name = relative(config.root, path);

  try {
    const className = readClassName(path);
    const { dex, classCount } = buildDex({ className, ...config });
    const error = await sendRedefinition({ className, dex }, config.port);
    const took = Date.now() - started;
    const extra = classCount > 1 ? ` +${classCount - 1}` : '';

    console.log(
      error === 0
        ? `  ✅ ${name}${extra}  ${took}ms`
        : `  ❌ ${name}  jvmtiError ${error}  ${took}ms`,
    );

    return error === 0;
  } catch (cause) {
    console.log(`  ❌ ${name}  ${cause.message.split('\n')[0]}`);

    return false;
  }
}
