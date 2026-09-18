import { DROPPED_FLAGS, DROPPED_WITH_VALUE } from '../constants/index.js';

/** Turns the module's own compile into one that builds a generation beside it. */
export function generationArgs(
  captured: string[],
  { moduleName, out }: { moduleName: string; out: string },
): string[] {
  const args: string[] = [];

  for (let i = 0; i < captured.length; i++) {
    const arg = captured[i] as string;

    if (arg === '-Xfrontend' && captured[i + 1] === '-const-gather-protocols-file') {
      i += 3;
      continue;
    }

    if (DROPPED_WITH_VALUE.includes(arg)) {
      i += 1;
      continue;
    }

    if (DROPPED_FLAGS.includes(arg) || arg.startsWith('-j')) continue;

    if (arg === '-module-name') {
      args.push('-module-name', moduleName);
      i += 1;
      continue;
    }

    args.push(arg);
  }

  return [
    ...args,
    '-emit-library',
    '-o',
    out,
    '-Xlinker',
    '-undefined',
    '-Xlinker',
    'dynamic_lookup',
    '-Xlinker',
    '-install_name',
    '-Xlinker',
    `@rpath/${moduleName}.dylib`,
  ];
}
