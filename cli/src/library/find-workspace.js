import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/** The Xcode workspace CocoaPods generated for the app that consumes this module. */
export function findWorkspace(root) {
  for (const candidate of ['example/ios', 'ios', '../ios']) {
    const at = join(root, candidate);
    if (!existsSync(at)) continue;

    const workspace = readdirSync(at).find((name) => name.endsWith('.xcworkspace'));
    if (workspace) return join(at, workspace);
  }

  return undefined;
}
