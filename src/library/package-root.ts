import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Where this package was installed, found by walking up rather than by counting folders. */
export function packageRoot(): string {
  let at = dirname(fileURLToPath(import.meta.url));

  while (!existsSync(join(at, 'package.json'))) {
    const up = dirname(at);
    if (up === at) throw new Error('no package.json above the installed files');
    at = up;
  }

  return at;
}
