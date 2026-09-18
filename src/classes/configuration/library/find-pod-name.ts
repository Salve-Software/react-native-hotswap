import { readdirSync } from 'node:fs';
import { PODSPEC } from '../constants/index.js';

/** The pod, and so the Xcode scheme, this module's Swift compiles into. */
export function findPodName(root: string): string | undefined {
  const podspec = readdirSync(root).find((name) => name.endsWith(PODSPEC));

  return podspec?.slice(0, -PODSPEC.length);
}
