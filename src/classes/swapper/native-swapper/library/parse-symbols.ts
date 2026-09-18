import type { NativeSymbol } from '../../../../types/index.js';
import { CODE_SYMBOLS } from '../constants/index.js';

/** The functions a library defines, from nm's posix output. */
export function parseSymbols(output: string): NativeSymbol[] {
  return output.split('\n').flatMap((line) => {
    const [name, type, , size] = line.trim().split(/\s+/);
    if (!name || !type || !CODE_SYMBOLS.includes(type)) return [];

    // No size means nm could not measure it, and the agent needs the measurement.
    const room = Number.parseInt(size ?? '', 16);

    return Number.isNaN(room) ? [] : [{ name, size: room }];
  });
}
