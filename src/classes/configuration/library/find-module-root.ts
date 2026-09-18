import { existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

/** Finds the module to watch, given where Metro was started. */
export function findModuleRoot(from: string): string {
  for (const candidate of [from, resolve(from, '..')]) {
    if (isLibrary(candidate)) return candidate;
  }

  // An app has neither marker and is its own root; refusing to start would be worse.
  return from;
}

// A podspec is the only marker an iOS-only library has.
function isLibrary(at: string): boolean {
  if (existsSync(join(at, 'android/src/main/java'))) return true;

  try {
    return readdirSync(at).some((entry) => entry.endsWith('.podspec'));
  } catch {
    return false;
  }
}
