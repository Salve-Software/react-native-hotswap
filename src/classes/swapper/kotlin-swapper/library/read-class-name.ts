import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { resolveClassName } from './resolve-class-name.js';

export function readClassName(file: string): string {
  return resolveClassName(readFileSync(file, 'utf8'), basename(file, '.kt'));
}
