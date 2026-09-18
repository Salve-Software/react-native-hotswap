import { framed } from '../../../agent/index.js';

export function sendImage(path: string): Buffer {
  return framed(path);
}
