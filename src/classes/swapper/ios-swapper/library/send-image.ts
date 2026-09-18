import { IMAGE } from '../../../../constants/index.js';
import { framed } from '../../../agent/index.js';

export function sendImage(path: string): Buffer {
  return Buffer.concat([Buffer.from([IMAGE]), framed(path)]);
}
