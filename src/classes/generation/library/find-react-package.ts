// BaseReactPackage and TurboReactPackage are how React Native asks for one now, so the name
// is matched by its ending rather than whole.
const DECLARES =
  /^\s*(?:\w+\s+)*class\s+(\w+)[^{]*?(?::|implements)[^{]*\b\w*ReactPackage\b/m;

export function findReactPackage(source: string): string | undefined {
  const name = DECLARES.exec(source)?.[1];
  if (!name) return undefined;

  const namespace = /^\s*package\s+([\w.]+)/m.exec(source)?.[1];

  return namespace ? `${namespace}.${name}` : undefined;
}
