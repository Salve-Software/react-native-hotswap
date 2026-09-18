import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** The spec a swap would silently contradict, or undefined when the ABI is intact. */
export function findStaleSpec(specs: string, generated: string): string | undefined {
  if (!existsSync(specs) || !existsSync(generated)) return undefined;

  const newest = newestMtime(generated);

  return readdirSync(specs)
    .filter((name) => name.endsWith('.nitro.ts'))
    .map((name) => join(specs, name))
    .find((path) => statSync(path).mtimeMs > newest);
}

function newestMtime(directory: string): number {
  let newest = 0;

  const walk = (at: string): void => {
    for (const entry of readdirSync(at, { withFileTypes: true })) {
      const path = join(at, entry.name);

      if (entry.isDirectory()) walk(path);
      else newest = Math.max(newest, statSync(path).mtimeMs);
    }
  };

  walk(directory);

  return newest;
}
