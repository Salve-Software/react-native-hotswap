import type { Platform } from '../types/index.js';
import { NATIVE_SOURCES } from '../constants/index.js';

export function platformsFor(path: string): Platform[] {
  if (path.endsWith('.kt')) return ['android'];
  if (path.endsWith('.swift')) return ['ios'];

  // .mm is left out: compiled into the patch it would define its classes a second time.
  if (NATIVE_SOURCES.some((extension) => path.endsWith(extension)))
    return ['android', 'ios'];

  return [];
}
