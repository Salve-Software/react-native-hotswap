import { relative } from 'node:path';
import { buildDex } from './build-dex.js';
import { findStaleSpec } from './find-stale-spec.js';
import { readClassName } from './read-class-name.js';
import { sendRedefinition } from './send-redefinition.js';

/** Swaps one Kotlin file into the running app and reports the outcome. */
export async function swapFile(path, config) {
  const started = Date.now();
  const name = relative(config.root, path);

  const stale = findStaleSpec(config.specs, config.generated);
  if (stale) {
    console.log(
      `  ⛔ ${name}  ${relative(config.root, stale)} changed; run codegen and rebuild`,
    );

    return false;
  }

  try {
    const className = readClassName(path);
    const definitions = buildDex({ className, ...config });
    const error = await sendRedefinition(definitions, config.port);
    const took = Date.now() - started;
    const extra = definitions.length > 1 ? ` +${definitions.length - 1}` : '';

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
