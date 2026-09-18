import { HEADERS, SWAPPABLE } from '../constants/index.js';

/** Whether a saved path is one a swap could act on, header included. */
export function isSwappable(path: string): boolean {
  return [...SWAPPABLE, ...HEADERS].some((end) => path.endsWith(end));
}
