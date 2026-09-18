import { swapKotlin } from './swap-kotlin.js';
import { swapSwift } from './swap-swift.js';

/** Routes a saved file to whichever platform knows how to replace it. */
export function swapFile(path, config) {
  if (path.endsWith('.kt')) return swapKotlin(path, config);
  if (path.endsWith('.swift')) return swapSwift(path, config);

  return Promise.resolve(false);
}
