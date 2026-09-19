import { readFileSync } from 'node:fs';

const DECLARES =
  /^[ \t]*(?:@\w+(?:\([^)]*\))?\s+)*(?:(?:public|internal|private|fileprivate|final|open)\s+)*(?:class|struct|enum|actor|protocol)\s+(\w+)/gm;

/** The types a Swift file declares, which are what another file would name to reach it. */
export function declaredTypes(source: string): string[] {
  return [...new Set([...source.matchAll(DECLARES)].map((match) => match[1] as string))];
}

/** Whether a source names any of them, which is as close as reading Swift without parsing it. */
export function namesAny(source: string, types: string[]): boolean {
  return types.some((type) => new RegExp(`\\b${type}\\b`).test(source));
}

/** The watched sources that reach a file, so an edit to it swaps through them instead. */
export function findSwiftCallers(file: string, sources: string[]): string[] {
  const types = declaredTypes(read(file));
  if (types.length === 0) return [];

  return sources.filter((source) => source !== file && namesAny(read(source), types));
}

function read(file: string): string {
  try {
    return readFileSync(file, 'utf8');
  } catch {
    return '';
  }
}
