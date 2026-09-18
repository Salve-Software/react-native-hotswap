interface Method {
  name: string;
  parameters: string;
  returns: string;
  body: string;
}

/** Rewrites a Swift file as an extension whose methods dynamically replace the originals. */
export function generateSwiftReplacement(source: string): string | undefined {
  const type = /^\s*(?:\w+\s+)*(?:final\s+)?class\s+(\w+)/m.exec(source)?.[1];
  if (!type) return undefined;

  const methods = findMethods(source).map(toReplacement);
  if (methods.length === 0) return undefined;

  return [imports(source), `extension ${type} {`, methods.join('\n\n'), '}', ''].join(
    '\n',
  );
}

function imports(source: string): string {
  const found = source.match(/^import .+$/gm) ?? ['import Foundation'];

  return `${found.join('\n')}\n`;
}

function findMethods(source: string): Method[] {
  const found: Method[] = [];
  const opener =
    /^([ \t]*)(?:@\w+\s+)*(?:(?:public|internal|private|fileprivate|open)\s+)?(?:override\s+)?func\s+(\w+)\s*\(([^)]*)\)([^{]*)\{/gm;

  let match: RegExpExecArray | null;
  while ((match = opener.exec(source)) !== null) {
    const read = readBody(source, opener.lastIndex - 1);
    if (read === undefined) continue;

    found.push({
      name: match[2] as string,
      parameters: match[3] as string,
      returns: (match[4] as string).trim(),
      body: read.body,
    });

    // A nested function is local and cannot be replaced, so the scan resumes past the body.
    opener.lastIndex = read.end;
  }

  return found;
}

// A brace inside a string or a comment would otherwise close the body early.
function readBody(
  source: string,
  openBrace: number,
): { body: string; end: number } | undefined {
  let depth = 0;
  let i = openBrace;

  while (i < source.length) {
    const skipped = skipNonCode(source, i);

    if (skipped > i) {
      i = skipped;
      continue;
    }

    if (source[i] === '{') depth++;
    else if (source[i] === '}') {
      depth--;
      if (depth === 0) return { body: source.slice(openBrace + 1, i), end: i };
    }

    i++;
  }

  return undefined;
}

function skipNonCode(source: string, at: number): number {
  if (source.startsWith('//', at)) {
    const line = source.indexOf('\n', at);

    return line === -1 ? source.length : line;
  }

  if (source.startsWith('/*', at)) {
    const close = source.indexOf('*/', at + 2);

    return close === -1 ? source.length : close + 2;
  }

  if (source[at] !== '"') return at;

  for (let i = at + 1; i < source.length; i++) {
    if (source[i] === '\\') i++;
    else if (source[i] === '"') return i + 1;
  }

  return source.length;
}

// Swift matches a replacement by argument labels, not by parameter names.
function toReplacement({ name, parameters, returns, body }: Method): string {
  const labels = parameters
    .split(',')
    .map((parameter) => parameter.trim().split(/\s|:/)[0])
    .filter(Boolean)
    .map((label) => `${label}:`)
    .join('');

  return [
    `  @_dynamicReplacement(for: ${name}(${labels}))`,
    `  func ${name}__hotswap(${parameters}) ${returns} {${body}}`,
  ].join('\n');
}
