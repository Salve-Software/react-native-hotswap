import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export function findWorkspace(root: string): string | undefined {
  for (const candidate of ['example/ios', 'ios', '../ios']) {
    const at = join(root, candidate);
    if (!existsSync(at)) continue;

    const workspace = readdirSync(at).find((name) => name.endsWith('.xcworkspace'));
    if (workspace) return join(at, workspace);
  }

  return undefined;
}
