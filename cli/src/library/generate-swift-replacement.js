/** Rewrites a Swift file as an extension whose methods dynamically replace the originals. */
export function generateSwiftReplacement(source) {
  const type = /^\s*(?:\w+\s+)*(?:final\s+)?class\s+(\w+)/m.exec(source)?.[1];
  if (!type) return undefined;

  const methods = findMethods(source).map(toReplacement);
  if (methods.length === 0) return undefined;

  return [imports(source), `extension ${type} {`, methods.join('\n\n'), '}', ''].join(
    '\n',
  );
}

function imports(source) {
  const found = source.match(/^import .+$/gm) ?? ['import Foundation'];

  return `${found.join('\n')}\n`;
}

/** Only methods are replaceable; a stored property has no implementation to swap. */
function findMethods(source) {
  const found = [];
  const opener =
    /^([ \t]*)(?:@\w+\s+)*(?:(?:public|internal|private|fileprivate|open)\s+)?(?:override\s+)?func\s+(\w+)\s*\(([^)]*)\)([^{]*)\{/gm;

  let match;
  while ((match = opener.exec(source)) !== null) {
    const body = readBody(source, opener.lastIndex - 1);
    if (body === undefined) continue;

    found.push({
      indent: match[1],
      name: match[2],
      parameters: match[3],
      returns: match[4].trim(),
      body,
    });
  }

  return found;
}

function readBody(source, openBrace) {
  let depth = 0;

  for (let i = openBrace; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') {
      depth--;
      if (depth === 0) return source.slice(openBrace + 1, i);
    }
  }

  return undefined;
}

/** The attribute names the original by its argument labels, which is what Swift matches on. */
function toReplacement({ name, parameters, returns, body }) {
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
