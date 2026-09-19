import type { Platform } from '../types/index.js';
import { NATIVE_SOURCES } from '../constants/index.js';

export function platformsFor(path: string): Platform[] {
  if (path.endsWith('.kt')) return ['android'];
  if (path.endsWith('.swift')) return ['ios'];

  if (NATIVE_SOURCES.some((extension) => path.endsWith(extension)))
    return ['android', 'ios'];

  return [];
}
