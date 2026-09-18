import { watch } from 'node:fs';
import { join } from 'node:path';

/** Calls back once per settled edit, ignoring the burst an editor save produces. */
export function watchKotlin(directory, onChange) {
  const pending = new Map();

  watch(directory, { recursive: true }, (_event, name) => {
    if (!name?.endsWith('.kt')) return;

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
