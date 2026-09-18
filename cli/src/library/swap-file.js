import { platformFor } from './platform-for.js';
import { swapKotlin } from './swap-kotlin.js';
import { swapIos } from './swap-ios.js';

const SWAPPERS = { android: swapKotlin, ios: swapIos };

/** Routes a saved file to whichever platform knows how to replace it. */
export function swapFile(path, config) {
  const swapper = SWAPPERS[platformFor(path)];

  return swapper ? swapper(path, config) : Promise.resolve(false);
}
