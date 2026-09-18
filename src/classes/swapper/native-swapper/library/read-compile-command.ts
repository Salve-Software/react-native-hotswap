import type { CompileCommand, SwapConfig } from '../../../../types/index.js';
import { readFileSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { findUnder } from '../../../../library/index.js';

type Where = Pick<SwapConfig, 'root' | 'project' | 'abi'>;

/** The exact command the project's own build uses to compile one C++ file. */
export function readCompileCommand(
  path: string,
  { root, project, abi }: Where,
): CompileCommand {
  const databases = [
    ...findUnder(join(root, 'android/.cxx'), [abi, 'compile_commands.json']),
    ...findUnder(join(project, 'app/.cxx'), [abi, 'compile_commands.json']),
  ];

  if (databases.length === 0) {
    throw new Error(
      'no compile_commands.json; build the app once with its native sources',
    );
  }

  // A library reached through node_modules records a path the developer never edits.
  const wanted = real(path);

  for (const database of databases) {
    const entries = JSON.parse(readFileSync(database, 'utf8')) as CompileCommand[];
    const entry = entries.find((candidate) => real(candidate.file) === wanted);

    if (entry) return entry;
  }

  throw new Error('nothing in the native build compiles this file');
}

function real(path: string): string {
  try {
    return realpathSync(path);
  } catch {
    return path;
  }
}
