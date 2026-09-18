import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { findUnder } from './find-under.js';

/** The exact command the project's own build uses to compile one C++ file. */
export function readCompileCommand(path, { root, project, abi }) {
  const databases = [
    ...findUnder(join(root, 'android/.cxx'), [abi, 'compile_commands.json']),
    ...findUnder(join(project, 'app/.cxx'), [abi, 'compile_commands.json']),
  ];

  if (databases.length === 0) {
    throw new Error(
      'no compile_commands.json; build the app once with its native sources',
    );
  }

  for (const database of databases) {
    const entry = JSON.parse(readFileSync(database, 'utf8')).find(
      (candidate) => candidate.file === path,
    );

    if (entry) return entry;
  }

  throw new Error('nothing in the native build compiles this file');
}
