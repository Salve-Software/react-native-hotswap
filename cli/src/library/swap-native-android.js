import { dirname, join, relative } from 'node:path';
import { buildSharedObject } from './build-shared-object.js';
import { findNativeLibrary } from './find-native-library.js';
import { forwardPort } from './forward-port.js';
import { readCompileCommand } from './read-compile-command.js';
import { readSymbols } from './read-symbols.js';
import { sendNative } from './send-native.js';
import { splitCommand } from './split-command.js';

const REASONS = { 1: 'the library would not load', 2: 'nothing was redirected' };

/** Recompiles one C++ file and points the running app's functions at the new code. */
export async function swapNativeAndroid(path, config) {
  const started = Date.now();
  const name = relative(config.root, path);

  try {
    forwardPort(config.port);

    const entry = readCompileCommand(path, config);
    const nm = join(dirname(splitCommand(entry.command)[0]), 'llvm-nm');
    const library = buildSharedObject(entry);

    // The room a jump needs is the original's, not the new one's: an edit that grows a
    // function would otherwise report space that the running code does not have.
    const room = new Map(
      readSymbols(findNativeLibrary(entry, config), nm).map(({ name: at, size }) => [
        at,
        size,
      ]),
    );

    const symbols = readSymbols(library, nm)
      .filter(({ name: at }) => room.has(at))
      .map(({ name: at }) => ({ name: at, size: room.get(at) }));

    if (symbols.length === 0) {
      throw new Error('nothing in this file is already running; rebuild');
    }

    const status = await sendNative({ path: library, symbols, port: config.port });
    const took = Date.now() - started;

    console.log(
      status === 0
        ? `  ✅ ${name}  ${took}ms`
        : `  ❌ ${name}  ${REASONS[status] ?? `status ${status}`}  ${took}ms`,
    );

    return status === 0;
  } catch (cause) {
    console.log(`  ❌ ${name}  ${cause.message.split('\n')[0]}`);

    return false;
  }
}
