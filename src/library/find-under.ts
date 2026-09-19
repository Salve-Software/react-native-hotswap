import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/** Every path under a directory whose last segments match, the Debug configuration first. */
export function findUnder(from: string, tail: string[]): string[] {
  if (!existsSync(from)) return [];

  const found: string[] = [];

  for (const entry of readdirSync(from, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;

    const at = join(from, entry.name);
    if (existsSync(join(at, ...tail))) found.push(join(at, ...tail));

    found.push(...findUnder(at, tail));
  }

  return found.sort((left, right) => debugFirst(left) - debugFirst(right));
}

function debugFirst(path: string): number {
  return path.includes('/Debug/') ? 0 : 1;
}
