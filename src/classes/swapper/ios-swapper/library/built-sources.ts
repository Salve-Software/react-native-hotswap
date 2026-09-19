import { readFileSync } from 'node:fs';
import { sourceListPath } from './patch-args.js';

/** The sources the running app was compiled from, as the captured invocation listed them. */
export function builtSources(captured: { swift: string[] | undefined }): string[] {
  const list = captured.swift && sourceListPath(captured.swift);
  if (!list) return [];

  return readFileSync(list, 'utf8')
    .split('\n')
    .map((line) => line.trim().replace(/^"|"$/g, ''))
    .filter(Boolean);
}
