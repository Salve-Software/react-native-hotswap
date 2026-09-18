import { readFileSync } from 'node:fs';
import { askAgent, framed } from './ask-agent.js';

const NATIVE = 1;

/** Sends a compiled library and the functions it redefines, and resolves with the status. */
export function sendNative({ path, symbols, port }) {
  const count = Buffer.alloc(4);
  count.writeUInt32BE(symbols.length);

  return askAgent(
    port,
    Buffer.concat([
      Buffer.from([NATIVE]),
      framed(readFileSync(path)),
      count,
      ...symbols.map(frame),
    ]),
  );
}

// The size travels with the name because the agent writes sixteen bytes over the original,
// and a shorter function would have its neighbour overwritten.
function frame({ name, size }) {
  const bytes = Buffer.alloc(4);
  bytes.writeUInt32BE(size);

  return Buffer.concat([framed(name), bytes]);
}
