import type { Platform } from '../../../types/index.js';
import type { Banner } from '../types/index.js';
import { IOS_NOTICE, NOTICE } from '../../../constants/index.js';
import { framed } from '../../agent/index.js';

/** Frames a banner for the agent to draw, its two halves kept apart so it can style them. */
export function sendNotice(banner: Banner, platform: Platform): Buffer {
  const kind = platform === 'ios' ? IOS_NOTICE : NOTICE;

  return Buffer.concat([
    Buffer.from([kind]),
    framed(banner.title),
    framed(banner.detail),
  ]);
}
