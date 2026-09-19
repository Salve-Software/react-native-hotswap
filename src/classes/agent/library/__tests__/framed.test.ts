import { describe, expect, it } from 'vitest';
import { framed } from '../framed.js';

describe('framed', () => {
  it('leads with the byte length, big endian, so the agent knows where the payload ends', () => {
    const message = framed('probe');

    expect(message.readUInt32BE(0)).toBe(5);
    expect(message.subarray(4).toString('utf8')).toBe('probe');
  });

  it('counts bytes and not characters, which is what a socket reads', () => {
    const message = framed('ProbeValues.kt · reloaded');

    expect(message.readUInt32BE(0)).toBe(
      Buffer.byteLength('ProbeValues.kt · reloaded', 'utf8'),
    );
    expect(message.readUInt32BE(0)).toBeGreaterThan('ProbeValues.kt · reloaded'.length);
  });

  it('frames a buffer without re-encoding it', () => {
    const message = framed(Buffer.from([0, 255, 128]));

    expect(message.readUInt32BE(0)).toBe(3);
    expect([...message.subarray(4)]).toEqual([0, 255, 128]);
  });

  it('frames an empty payload as a length of zero', () => {
    expect(framed('').readUInt32BE(0)).toBe(0);
    expect(framed('')).toHaveLength(4);
  });
});
