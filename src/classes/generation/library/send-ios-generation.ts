import { IOS_GENERATION } from '../../../constants/index.js';
import { framed } from '../../agent/index.js';

export function sendIosGeneration(path: string): Buffer {
  return Buffer.concat([Buffer.from([IOS_GENERATION]), framed(path)]);
}
