/** Derives the JNI class name Kotlin source compiles into. */
export function resolveClassName(source, fileName) {
  const pkg = /^\s*package\s+([\w.]+)/m.exec(source)?.[1];
  if (!pkg) throw new Error(`no package declaration in ${fileName}.kt`);

  const declares = new RegExp(
    `^\\s*(?:\\w+\\s+)*(?:class|object|interface)\\s+${fileName}\\b`,
    'm',
  );
  const simple = declares.test(source) ? fileName : `${fileName}Kt`;

  return `${pkg.replace(/\./g, '/')}/${simple}`;
}
