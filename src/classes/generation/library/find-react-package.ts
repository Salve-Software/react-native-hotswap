const DECLARES =
  /^\s*(?:\w+\s+)*class\s+(\w+)[^{]*?(?::|implements)[^{]*\bReactPackage\b/m;

/** The fully qualified React package a source file declares, if it declares one. */
export function findReactPackage(source: string): string | undefined {
  const name = DECLARES.exec(source)?.[1];
  if (!name) return undefined;

  const namespace = /^\s*package\s+([\w.]+)/m.exec(source)?.[1];

  return namespace ? `${namespace}.${name}` : undefined;
}
