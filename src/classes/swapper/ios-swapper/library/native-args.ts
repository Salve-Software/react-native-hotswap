import { NATIVE_DROPPED_FLAGS, NATIVE_DROPPED_WITH_VALUE } from '../constants/index.js';

/** Turns Xcode's compile of the patch into one that writes where this package can reach. */
export function nativeArgs(
  captured: string[],
  { object, cache }: { object: string; cache: string },
): string[] {
  const args: string[] = [];

  for (let i = 0; i < captured.length; i++) {
    const arg = captured[i] as string;

    if (NATIVE_DROPPED_WITH_VALUE.includes(arg)) {
      i += 1;
      continue;
    }

    if (NATIVE_DROPPED_FLAGS.includes(arg) || arg.startsWith('-fmodules-cache-path=')) {
      continue;
    }

    args.push(arg);
  }

  return [...args, `-fmodules-cache-path=${cache}`, '-o', object];
}
