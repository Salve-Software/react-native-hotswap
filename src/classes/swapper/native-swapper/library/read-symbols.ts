import { execFileSync } from 'node:child_process';
import { parseSymbols } from './parse-symbols.js';
import type { NativeSymbol } from '../../../../types/index.js';

export function readSymbols(library: string, nm: string): NativeSymbol[] {
  const output = execFileSync(
    nm,
    ['--defined-only', '--print-size', '--format=posix', library],
    { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 },
  );

  return parseSymbols(output);
}
