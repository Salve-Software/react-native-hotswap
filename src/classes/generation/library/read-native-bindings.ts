import { readFileSync } from 'node:fs';
import { findSources } from '../../../library/index.js';
import { nativeBinding } from './native-binding.js';

/** Read from what was compiled, not from source: a generation never sees the whole module. */
export function readNativeBindings(classes: string): string[] {
  const bound = new Set<string>();

  for (const file of findSources([classes], ['.class'])) {
    const name = nativeBinding(readFileSync(file));
    if (name) bound.add(name);
  }

  return [...bound];
}
