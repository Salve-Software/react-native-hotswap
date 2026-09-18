import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const TRANSLATION_UNITS = ['.cpp', '.cc', '.cxx', '.mm'];

/** Every translation unit under the watched directories, as candidates for a header. */
export function findSources(directories: string[]): string[] {
  return directories.filter((at) => existsSync(at)).flatMap(walk);
}

function walk(at: string): string[] {
  return readdirSync(at, { withFileTypes: true }).flatMap((entry) => {
    const path = join(at, entry.name);

    if (entry.isDirectory()) return walk(path);

    return TRANSLATION_UNITS.some((end) => entry.name.endsWith(end)) ? [path] : [];
  });
}
