import { readdirSync } from 'node:fs';

/** The pod, and so the Xcode scheme, this module's Swift compiles into. */
export function findPodName(root) {
  const podspec = readdirSync(root).find((name) => name.endsWith('.podspec'));

  return podspec?.slice(0, -'.podspec'.length);
}
