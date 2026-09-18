import type { Platform } from '../types/index.js';

const NATIVE = ['.cpp', '.cc', '.cxx'];

/** Which platforms know how to replace a saved file, if any do. */
export function platformsFor(path: string): Platform[] {
  if (path.endsWith('.kt')) return ['android'];
  if (path.endsWith('.swift')) return ['ios'];

  // A C++ file under a Nitro module is compiled into both apps, so a save belongs to both.
  // Objective-C++ is deliberately absent: including a .mm into the patch would define its
  // classes a second time, and the runtime resolves that by picking one of them.
  if (NATIVE.some((extension) => path.endsWith(extension))) return ['android', 'ios'];

  return [];
}
