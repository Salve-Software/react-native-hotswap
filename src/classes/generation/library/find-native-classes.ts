const NATIVE = /^\s*(?:\w+\s+)*external\s+fun\b/m;

/** The class a file binds a native library from, which a generation cannot own. */
export function findNativeClass(source: string): string | undefined {
  if (!NATIVE.test(source)) return undefined;

  const name = /^\s*(?:\w+\s+)*(?:class|object)\s+(\w+)/m.exec(source)?.[1];
  const namespace = /^\s*package\s+([\w.]+)/m.exec(source)?.[1];

  return name && namespace ? `${namespace}.${name}` : undefined;
}
