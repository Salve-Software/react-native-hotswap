import { NATIVE_PATCH, SWIFT_PATCH } from '../../../../constants/index.js';
import { generateSwiftReplacement } from './generate-swift-replacement.js';
import type { Patch } from '../../../../types/index.js';

/** What to write into the file Xcode compiles, for the language of the saved file. */
export function patchFor(path: string, source: string): Patch | undefined {
  if (!path.endsWith('.swift')) return { ...NATIVE_PATCH, contents: include(path) };

  const replacement = generateSwiftReplacement(source);

  return replacement ? { ...SWIFT_PATCH, contents: replacement } : undefined;
}

// Including the translation unit is what gets it compiled with the target's own flags and
// header search paths. The absolute path keeps its own relative includes resolving, since a
// quoted include is looked up beside the file that wrote it.
function include(path: string): string {
  return `#include "${path}"\n`;
}
