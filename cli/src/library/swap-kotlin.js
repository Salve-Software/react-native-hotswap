import { relative } from 'node:path';
import { execFileSync } from 'node:child_process';
import { buildDex } from './build-dex.js';
import { explainJvmtiError } from './explain-jvmti-error.js';
import { findStaleSpec } from './find-stale-spec.js';
import { readClassName } from './read-class-name.js';
import { sendRedefinition } from './send-redefinition.js';

/** A device that reconnected drops the forward, and the next swap would time out. */
function forward(port) {
  try {
    execFileSync('adb', ['forward', `tcp:${port}`, `tcp:${port}`], { stdio: 'ignore' });
  } catch {
    // No device is a normal state when only iOS is in play.
  }
}

/** Swaps one Kotlin file into the running app and reports the outcome. */
export async function swapKotlin(path, config) {
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
    forward(config.port);

    const className = readClassName(path);
    const definitions = buildDex({ className, ...config });
    const error = await sendRedefinition(definitions, config.port);
    const took = Date.now() - started;
    const extra = definitions.length > 1 ? ` +${definitions.length - 1}` : '';

    console.log(
      error === 0
        ? `  ✅ ${name}${extra}  ${took}ms`
        : `  ❌ ${name}  ${explainJvmtiError(error)}  ${took}ms`,
    );

    return error === 0;
  } catch (cause) {
    console.log(`  ❌ ${name}  ${cause.message.split('\n')[0]}`);

    return false;
  }
}
