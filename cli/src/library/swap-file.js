import { platformFor } from './platform-for.js';
import { swapKotlin } from './swap-kotlin.js';
import { swapSwift } from './swap-swift.js';

const SWAPPERS = { android: swapKotlin, ios: swapSwift };

/** Routes a saved file to whichever platform knows how to replace it. */
export function swapFile(path, config) {
  const swapper = SWAPPERS[platformFor(path)];

  return swapper ? swapper(path, config) : Promise.resolve(false);
}
