import type { ClassDefinition } from '../../../../types/index.js';
import { CLASSES } from '../../../../constants/index.js';
import { framed } from '../../../agent/index.js';

export function sendRedefinition(definitions: ClassDefinition[]): Buffer {
  const count = Buffer.alloc(4);
  count.writeUInt32BE(definitions.length);

  return Buffer.concat([Buffer.from([CLASSES]), count, ...definitions.map(frame)]);
}

function frame({ className, dex }: ClassDefinition): Buffer {
  return Buffer.concat([framed(className), framed(dex)]);
}
