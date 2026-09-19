import { DROPPED_FLAGS, DROPPED_WITH_VALUE } from '../constants/index.js';

/** Turns the module's own compile into one that emits an object per file and nothing else. */
export function patchArgs(
  captured: string[],
  { map, cache }: { map: string; cache: string },
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

    if (DROPPED_FLAGS.includes(arg) || arg === '-c') continue;

    args.push(arg);
  }

  return [...args, '-c', '-output-file-map', map, '-module-cache-path', cache];
}

/** The list Xcode passes the sources in, which the output map has to name one by one. */
export function sourceListPath(captured: string[]): string | undefined {
  return captured
    .find((arg) => arg.startsWith('@') && arg.endsWith('.SwiftFileList'))
    ?.slice(1);
}
