import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { splitCommand } from './split-command.js';

/**
 * Compiles one changed file into a library the running app can load.
 *
 * The command comes from the project's own build rather than being reconstructed, so the
 * flags, defines and include paths are the ones the installed code was built with.
 */
export function buildSharedObject(entry) {
  const args = splitCommand(entry.command);
  const at = mkdtempSync(join(tmpdir(), 'hotswap-'));
  const object = join(at, 'patch.o');

  execFileSync(args[0], withOutput(args.slice(1), object), {
    cwd: entry.directory,
    stdio: 'pipe',
    maxBuffer: 64 * 1024 * 1024,
  });

  // The linker keys a library on its soname, so a name reused across swaps would come back
  // as the one already mapped and the new file would never be loaded.
  const name = `libhotswap-patch-${Date.now()}.so`;
  const library = join(at, name);

  execFileSync(
    args[0],
    [
      ...args.filter((argument) => argument.startsWith('--target=')),
      ...args.filter((argument) => argument.startsWith('--sysroot=')),
      '-shared',
      `-Wl,-soname,${name}`,
      '-o',
      library,
      object,
    ],
    { stdio: 'pipe', maxBuffer: 64 * 1024 * 1024 },
  );

  return library;
}

function withOutput(args, object) {
  const at = args.indexOf('-o');
  if (at === -1) return [...args, '-o', object];

  return args.map((argument, index) => (index === at + 1 ? object : argument));
}
