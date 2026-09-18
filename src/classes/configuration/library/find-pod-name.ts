import { readdirSync } from 'node:fs';

const SUFFIX = '.podspec';

/** The pod, and so the Xcode scheme, this module's Swift compiles into. */
export function findPodName(root: string): string | undefined {
  const podspec = readdirSync(root).find((name) => name.endsWith(SUFFIX));

  return podspec?.slice(0, -SUFFIX.length);
}
