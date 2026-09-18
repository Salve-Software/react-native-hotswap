import type { SwapOverrides } from '../../../types/index.js';
import { resolve } from 'node:path';
import { OVERRIDDEN_PATHS } from '../constants/index.js';

/** Reads every path in hotswap.config.json as relative to the module, never to cwd. */
export function resolveOverrides(root: string, overrides: SwapOverrides): SwapOverrides {
  const resolved: SwapOverrides = { ...overrides };

  for (const key of OVERRIDDEN_PATHS) {
    const value = resolved[key];
    if (value) resolved[key] = resolve(root, value);
  }

  if (resolved.watch) resolved.watch = resolved.watch.map((at) => resolve(root, at));

  return resolved;
}
