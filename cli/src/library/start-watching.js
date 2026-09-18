import { relative } from 'node:path';
import { serialize } from './serialize.js';
import { swapFile } from './swap-file.js';
import { watchSources } from './watch-sources.js';

/** Watches native sources and swaps each saved file into the running app. */
export function startWatching(config) {
  const watched = config.watch.map((at) => relative(config.root, at)).join(', ');
  const queue = serialize();

  console.log(`hotswap  watching ${watched}`);

  watchSources(config.watch, (path) => queue(() => swapFile(path, config)));
}
