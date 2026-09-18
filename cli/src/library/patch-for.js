import { generateSwiftReplacement } from './generate-swift-replacement.js';

const SWIFT = { file: 'HotswapPatch.swift', placeholder: 'import Foundation\n' };
const NATIVE = { file: 'HotswapPatchNative.mm', placeholder: '\n' };

/** Every file Xcode has to know about before it can compile any swap at all. */
export const PATCHES = [SWIFT, NATIVE];

/** What to write into the file Xcode compiles, for the language of the saved file. */
export function patchFor(path, source) {
  if (!path.endsWith('.swift')) return { ...NATIVE, contents: include(path) };

  const replacement = generateSwiftReplacement(source);

  return replacement ? { ...SWIFT, contents: replacement } : undefined;
}

// Including the translation unit is what gets it compiled with the target's own flags and
// header search paths. The absolute path keeps its own relative includes resolving, since a
// quoted include is looked up beside the file that wrote it.
function include(path) {
  return `#include "${path}"\n`;
}
