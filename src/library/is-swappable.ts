import { HEADERS, SWAPPABLE } from '../constants/index.js';

export function isSwappable(path: string): boolean {
  return [...SWAPPABLE, ...HEADERS].some((end) => path.endsWith(end));
}
