import type { CompileCommand } from '../../../../types/index.js';
import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { splitCommand } from './split-command.js';

export function buildSharedObject(entry: CompileCommand, against: string): string {
  const args = splitCommand(entry.command);
  const compiler = args[0] as string;
  const at = mkdtempSync(join(tmpdir(), 'hotswap-'));
  const object = join(at, 'patch.o');

  execFileSync(compiler, withOutput(args.slice(1), object), {
    cwd: entry.directory,
    stdio: 'pipe',
    maxBuffer: 64 * 1024 * 1024,
  });

  const name = `libhotswap-patch-${Date.now()}.so`;
  const library = join(at, name);

  execFileSync(
    compiler,
    [
      ...args.filter((argument) => argument.startsWith('--target=')),
      ...args.filter((argument) => argument.startsWith('--sysroot=')),
      '-shared',
      `-Wl,-soname,${name}`,
      '-o',
      library,
      object,
      `-L${dirname(against)}`,
      `-l${basename(against).replace(/^lib|\.so$/g, '')}`,
    ],
    { stdio: 'pipe', maxBuffer: 64 * 1024 * 1024 },
  );

  return library;
}

function withOutput(args: string[], object: string): string[] {
  const at = args.indexOf('-o');
  if (at === -1) return [...args, '-o', object];

  return args.map((argument, index) => (index === at + 1 ? object : argument));
}
