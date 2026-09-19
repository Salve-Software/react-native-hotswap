import type { Patch } from '../../../../types/index.js';
import { NATIVE_PATCH, SWIFT_PATCH } from '../../../../constants/index.js';
import { generateSwiftReplacement } from './generate-swift-replacement.js';

export function patchFor(path: string, source: string): Patch | undefined {
  if (!path.endsWith('.swift')) return { ...NATIVE_PATCH, contents: include(path) };

  const replacement = generateSwiftReplacement(source);

  return replacement ? { ...SWIFT_PATCH, contents: replacement } : undefined;
}

function include(path: string): string {
  return `#include "${path}"\n`;
}
