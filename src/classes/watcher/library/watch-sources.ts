import { existsSync, watch } from 'node:fs';
import { basename, join } from 'node:path';

const SOURCES = ['.kt', '.swift', '.cpp', '.cc', '.cxx'];
const SETTLE = 120;

// The iOS path writes these files itself, and watching them would make every swap trigger
// another one.
const GENERATED = 'HotswapPatch';

/** Calls back once per settled edit, ignoring the burst an editor save produces. */
export function watchSources(
  directories: string[],
  onChange: (path: string) => void,
): void {
  const pending = new Map<string, NodeJS.Timeout>();

  for (const directory of directories.filter((at) => existsSync(at))) {
    watch(directory, { recursive: true }, (_event, name) => {
      if (!name || !SOURCES.some((extension) => name.endsWith(extension))) return;
      if (basename(name).startsWith(GENERATED)) return;

      const file = join(directory, name);
      clearTimeout(pending.get(file));
      pending.set(
        file,
        setTimeout(() => {
          pending.delete(file);
          onChange(file);
        }, SETTLE),
      );
    });
  }
}
