import { join } from 'node:path';
import { findUnder } from '../../../../library/index.js';
import type { CompileCommand, SwapConfig } from '../../../../types/index.js';

type Where = Pick<SwapConfig, 'root' | 'project' | 'abi'>;

/** The unstripped library this file compiles into, which is where the original runs from. */
export function findNativeLibrary(
  entry: CompileCommand,
  { root, project, abi }: Where,
): string {
  const target = /-D(\w+)_EXPORTS/.exec(entry.command)?.[1];
  if (!target) throw new Error('this file is not compiled into a library of its own');

  const tail = ['obj', abi, `lib${target}.so`];
  const found = [
    ...findUnder(join(root, 'android/build/intermediates/cxx'), tail),
    ...findUnder(join(project, 'app/build/intermediates/cxx'), tail),
  ];

  const first = found[0];
  if (!first) throw new Error(`no built lib${target}.so to measure against`);

  return first;
}
