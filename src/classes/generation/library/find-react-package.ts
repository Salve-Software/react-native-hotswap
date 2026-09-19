// BaseReactPackage and TurboReactPackage end with it, so the name matches by its ending.
const DECLARES =
  /^\s*(?:\w+\s+)*class\s+(\w+)[^{]*?(?::|implements)[^{]*\b\w*ReactPackage\b/m;

export function findReactPackage(source: string): string | undefined {
  const name = DECLARES.exec(source)?.[1];
  if (!name) return undefined;

  const namespace = /^\s*package\s+([\w.]+)/m.exec(source)?.[1];

  return namespace ? `${namespace}.${name}` : undefined;
}
