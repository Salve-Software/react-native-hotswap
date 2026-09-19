const DECLARED =
  /^\s*(?:@objc(?:\([^)]*\))?\s+)(?:(?:public|internal|final|open)\s+)*class\s+(\w+)/gm;

/** The classes a generation exposes by name, since nothing may look them up globally. */
export function generateFactory(sources: string[]): string {
  const names = [...new Set(sources.flatMap(classesIn))];

  if (names.length === 0) {
    throw new Error(
      'no @objc class here, so a generation would reload and change nothing',
    );
  }

  const cases = names.map(
    (name) =>
      `  case "${name}": return unsafeBitCast(${name}.self, to: UnsafeRawPointer.self)`,
  );

  return [
    'import Foundation',
    '',
    '@_cdecl("hotswapClassNamed")',
    'public func hotswapClassNamed(_ name: UnsafePointer<CChar>) -> UnsafeRawPointer? {',
    '  switch String(cString: name) {',
    ...cases,
    '  default: return nil',
    '  }',
    '}',
    '',
  ].join('\n');
}

function classesIn(source: string): string[] {
  return [...source.matchAll(DECLARED)].map((match) => match[1] as string);
}
