import type { Platform } from '../../../types/index.js';
import { IOS_NOTICE, NOTICE } from '../../../constants/index.js';
import { framed } from '../../agent/index.js';

/** Frames a line of text for the agent to show on screen. */
export function sendNotice(text: string, platform: Platform): Buffer {
  const kind = platform === 'ios' ? IOS_NOTICE : NOTICE;

  return Buffer.concat([Buffer.from([kind]), framed(text)]);
}
