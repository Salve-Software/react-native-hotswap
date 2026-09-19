import { existsSync, readFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { INCLUDE_DEPTH } from '../constants/index.js';
import { parseIncludes } from './parse-includes.js';

/** The translation units that reach a header, directly or through another header. */
export function findDependents(header: string, sources: string[]): string[] {
  const wanted = basename(header);

  return sources.filter((source) => reaches(source, { wanted, seen: new Set() }));
}

interface Search {
  wanted: string;
  seen: Set<string>;
}

function reaches(file: string, { wanted, seen }: Search): boolean {
  if (seen.has(file) || seen.size > INCLUDE_DEPTH * INCLUDE_DEPTH || !existsSync(file))
    return false;
  seen.add(file);

  const includes = parseIncludes(read(file));
  if (includes.some((include) => basename(include) === wanted)) return true;

  return includes
    .map((include) => resolve(dirname(file), include))
    .some((next) => reaches(next, { wanted, seen }));
}

function read(file: string): string {
  try {
    return readFileSync(file, 'utf8');
  } catch {
    return '';
  }
}
