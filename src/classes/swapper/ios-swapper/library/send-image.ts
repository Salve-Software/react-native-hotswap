import { framed } from '../../../agent/index.js';

/** Frames one dylib path the way the iOS loader reads it. */
export function sendImage(path: string): Buffer {
  return framed(path);
}
