import { describe, expect, it } from 'vitest';
import { sendNotice } from '../send-notice.js';

const banner = { title: 'Refreshing native', detail: 'Probe.kt' };

describe('sendNotice', () => {
  it('leads with the kind each platform answers to', () => {
    expect(sendNotice(banner, 'android')[0]).toBe(3);
    expect(sendNotice(banner, 'ios')[0]).toBe(2);
  });

  it('frames the halves apart so the agent can style them differently', () => {
    const message = sendNotice(banner, 'ios');
    const title = message.readUInt32BE(1);
    const detail = message.readUInt32BE(5 + title);

    expect(message.subarray(5, 5 + title).toString('utf8')).toBe(banner.title);
    expect(message.subarray(9 + title, 9 + title + detail).toString('utf8')).toBe(
      banner.detail,
    );
  });
});
