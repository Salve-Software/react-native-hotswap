/** Length-prefixed, the way every frame in these protocols is. */
export function framed(value: Buffer | string): Buffer {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(value, 'utf8');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(bytes.length);

  return Buffer.concat([length, bytes]);
}
