import { relative } from 'node:path';
import { swapFile } from './swap-file.js';
import { watchSources } from './watch-sources.js';

/** Watches native sources and swaps each saved file into the running app. */
export function startWatching(config) {
  const watched = config.watch.map((at) => relative(config.root, at)).join(', ');

  console.log(`hotswap  watching ${watched}`);

  watchSources(config.watch, (path) => swapFile(path, config));
}
