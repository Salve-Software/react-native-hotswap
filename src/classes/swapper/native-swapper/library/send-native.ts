import { readFileSync } from 'node:fs';
import { framed } from '../../../agent/index.js';
import type { NativeSymbol } from '../../../../types/index.js';

const NATIVE = 1;

/** Frames a compiled library and the functions it redefines, the way the agent reads them. */
export function sendNative(path: string, symbols: NativeSymbol[]): Buffer {
  const count = Buffer.alloc(4);
  count.writeUInt32BE(symbols.length);

  return Buffer.concat([
    Buffer.from([NATIVE]),
    framed(readFileSync(path)),
    count,
    ...symbols.map(frame),
  ]);
}

// The size travels with the name because the agent writes sixteen bytes over the original,
// and a shorter function would have its neighbour overwritten.
function frame({ name, size }: NativeSymbol): Buffer {
  const bytes = Buffer.alloc(4);
  bytes.writeUInt32BE(size);

  return Buffer.concat([framed(name), bytes]);
}
