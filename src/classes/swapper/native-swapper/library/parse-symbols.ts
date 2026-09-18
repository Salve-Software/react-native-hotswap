import type { NativeSymbol } from '../../../../types/index.js';

const CODE = 'TtWw';

/** The functions a library defines, from nm's posix output. */
export function parseSymbols(output: string): NativeSymbol[] {
  return output.split('\n').flatMap((line) => {
    const [name, type, , size] = line.trim().split(/\s+/);
    if (!name || !type || !CODE.includes(type)) return [];

    // A symbol with no size recorded is one nm could not measure, and the agent needs the
    // measurement to know the original has room for a jump.
    const room = Number.parseInt(size ?? '', 16);

    return Number.isNaN(room) ? [] : [{ name, size: room }];
  });
}
