import type { NativeSymbol } from '../../../../types/index.js';
import { readFileSync } from 'node:fs';
import { NATIVE_LIBRARY } from '../../../../constants/index.js';
import { framed } from '../../../agent/index.js';

export function sendNative(path: string, symbols: NativeSymbol[]): Buffer {
  const count = Buffer.alloc(4);
  count.writeUInt32BE(symbols.length);

  return Buffer.concat([
    Buffer.from([NATIVE_LIBRARY]),
    framed(readFileSync(path)),
    count,
    ...symbols.map(frame),
  ]);
}

// The size travels along because the agent needs to know the original has room.
function frame({ name, size }: NativeSymbol): Buffer {
  const bytes = Buffer.alloc(4);
  bytes.writeUInt32BE(size);

  return Buffer.concat([framed(name), bytes]);
}
