import { existsSync, watch } from 'node:fs';
import { join } from 'node:path';

const SOURCES = ['.kt', '.swift'];

/** Calls back once per settled edit, ignoring the burst an editor save produces. */
export function watchSources(directories, onChange) {
  const pending = new Map();

  for (const directory of directories.filter((d) => existsSync(d))) {
    watch(directory, { recursive: true }, (_event, name) => {
      if (!SOURCES.some((extension) => name?.endsWith(extension))) return;

      const file = join(directory, name);
      clearTimeout(pending.get(file));
      pending.set(
        file,
        setTimeout(() => {
          pending.delete(file);
          onChange(file);
        }, 120),
      );
    });
  }
}
