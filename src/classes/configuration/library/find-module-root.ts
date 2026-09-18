import { existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

/** Finds the module to watch, given where Metro was started. */
export function findModuleRoot(from: string): string {
  for (const candidate of [from, resolve(from, '..')]) {
    if (isLibrary(candidate)) return candidate;
  }

  // An app has neither marker and is its own root. Guessing wrong here is cheap to correct
  // and refusing to start is not, since the watcher is the only thing the user asked for.
  return from;
}

// A podspec is what tells a library apart from the example app beside it, and an iOS-only
// library is the case with no android/src/main/java to look for.
function isLibrary(at: string): boolean {
  if (existsSync(join(at, 'android/src/main/java'))) return true;

  try {
    return readdirSync(at).some((entry) => entry.endsWith('.podspec'));
  } catch {
    return false;
  }
}
