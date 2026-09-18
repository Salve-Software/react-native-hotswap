import { forwardPort } from './forward-port.js';
import { platformsFor } from './platforms-for.js';
import { reachable } from './reachable.js';
import { swapIos } from './swap-ios.js';
import { swapKotlin } from './swap-kotlin.js';
import { swapNativeAndroid } from './swap-native-android.js';

const SWAPPERS = {
  android: (path, config) =>
    path.endsWith('.kt') ? swapKotlin(path, config) : swapNativeAndroid(path, config),
  ios: swapIos,
};

/** Routes a saved file to whichever platform knows how to replace it. */
export async function swapFile(path, config) {
  const platforms = await intendedFor(path, config);

  let swapped = false;
  for (const platform of platforms) {
    if (await SWAPPERS[platform](path, config)) swapped = true;
  }

  return swapped;
}

/**
 * Narrows a shared file to the platforms actually running.
 *
 * A C++ file belongs to both, and someone developing against one simulator does not want a
 * failure line for the device they never started. A file only one platform can take is left
 * alone, so its own diagnosis is what gets printed.
 */
async function intendedFor(path, config) {
  const platforms = platformsFor(path);
  if (platforms.length < 2) return platforms;

  forwardPort(config.port);

  const listening = await Promise.all([
    reachable(config.port),
    reachable(config.iosPort),
  ]);

  return platforms.filter((_, at) => listening[at]);
}
