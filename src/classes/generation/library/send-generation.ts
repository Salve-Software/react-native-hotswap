import { GENERATION } from '../../../constants/index.js';
import { framed } from '../../agent/index.js';

interface Manifest {
  packages: string[];
  shared: string[];
}

export function sendGeneration(dexes: Buffer[], manifest: Manifest): Buffer {
  const names = [...manifest.packages, ...manifest.shared.map((name) => `!${name}`)];

  return Buffer.concat([
    Buffer.from([GENERATION]),
    count(dexes),
    ...dexes.map(framed),
    count(names),
    ...names.map(framed),
  ]);
}

function count(of: unknown[]): Buffer {
  const bytes = Buffer.alloc(4);
  bytes.writeUInt32BE(of.length);

  return bytes;
}
