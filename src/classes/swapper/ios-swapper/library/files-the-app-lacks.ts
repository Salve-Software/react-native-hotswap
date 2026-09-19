import { basename } from 'node:path';

/** Sources compiled now that the running app was never built from, so it cannot resolve them. */
export function filesTheAppLacks(built: string[], present: string[]): string[] {
  const known = new Set(built.map((file) => basename(file)));

  return present.filter((file) => !known.has(basename(file)));
}
