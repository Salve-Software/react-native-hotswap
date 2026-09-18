import { describe, expect, it } from 'vitest';
import { sendNotice } from '../send-notice.js';

describe('sendNotice', () => {
  it('leads with the kind each platform answers to', () => {
    expect(sendNotice('a', 'android')[0]).toBe(3);
    expect(sendNotice('a', 'ios')[0]).toBe(2);
  });

  it('frames the text with its length so the agent knows where it ends', () => {
    const message = sendNotice('hotswap · Probe.kt', 'ios');
    const length = message.readUInt32BE(1);

    expect(message.subarray(5).toString('utf8')).toHaveLength(
      'hotswap · Probe.kt'.length,
    );
    expect(length).toBe(Buffer.byteLength('hotswap · Probe.kt', 'utf8'));
  });
});
