import { resolve } from 'node:path';

const PATHS = ['project', 'classes', 'specs', 'generated', 'patchDir'];

/** Reads every path in hotswap.config.json as relative to the module, never to cwd. */
export function resolveOverrides(root, overrides) {
  const resolved = { ...overrides };

  for (const key of PATHS) {
    if (resolved[key]) resolved[key] = resolve(root, resolved[key]);
  }

  if (resolved.watch) resolved.watch = resolved.watch.map((at) => resolve(root, at));

  return resolved;
}
