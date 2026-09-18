import { relative } from 'node:path';
import { swapFile } from './swap-file.js';
import { watchKotlin } from './watch-kotlin.js';

/** Watches the module's Kotlin and swaps each saved file into the running app. */
export function startWatching(config) {
  console.log(
    `hotswap  watching ${relative(config.root, config.watch)}  →  127.0.0.1:${config.port}`,
  );

  watchKotlin(config.watch, (path) => swapFile(path, config));
}
