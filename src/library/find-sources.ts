import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const TRANSLATION_UNITS = ['.cpp', '.cc', '.cxx', '.mm'];

/** Every file of the given kinds under the given directories. */
export function findSources(directories: string[], kinds = TRANSLATION_UNITS): string[] {
  return directories.filter((at) => existsSync(at)).flatMap((at) => walk(at, kinds));
}

function walk(at: string, kinds: string[]): string[] {
  return readdirSync(at, { withFileTypes: true }).flatMap((entry) => {
    const path = join(at, entry.name);

    if (entry.isDirectory()) return walk(path, kinds);

    return kinds.some((end) => entry.name.endsWith(end)) ? [path] : [];
  });
}
