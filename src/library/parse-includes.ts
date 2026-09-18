const QUOTED = /^[ \t]*#\s*include\s+"([^"]+)"/gm;

/** The quoted includes a translation unit names, which are the ones a project owns. */
export function parseIncludes(source: string): string[] {
  return [...source.matchAll(QUOTED)].map((match) => match[1] as string);
}
