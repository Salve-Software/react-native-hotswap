interface Method {
  name: string;
  parameters: string;
  returns: string;
  body: string;
}

interface Declaration {
  name: string;
  body: string;
}

export function generateSwiftReplacement(source: string): string | undefined {
  const extensions = findDeclarations(source)
    .map(toExtension)
    .filter((extension): extension is string => extension !== undefined);

  if (extensions.length === 0) return undefined;

  return [imports(source), ...extensions, ''].join('\n');
}

function toExtension({ name, body }: Declaration): string | undefined {
  const methods = findMethods(body).map(toReplacement);
  if (methods.length === 0) return undefined;

  return [`extension ${name} {`, methods.join('\n\n'), '}'].join('\n');
}

// A nested type goes with its parent's body: replacing it needs the qualified name.
function findDeclarations(source: string): Declaration[] {
  const found: Declaration[] = [];
  const opener =
    /^[ \t]*(?:@\w+(?:\([^)]*\))?\s+)*(?:(?:public|internal|private|fileprivate|open|final)\s+)*(?:class|struct|enum|actor|extension)\s+(\w+)[^{]*\{/gm;

  let match: RegExpExecArray | null;
  while ((match = opener.exec(source)) !== null) {
    const read = readBody(source, opener.lastIndex - 1);
    if (read === undefined) continue;

    found.push({ name: match[1] as string, body: read.body });
    opener.lastIndex = read.end;
  }

  return found;
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
