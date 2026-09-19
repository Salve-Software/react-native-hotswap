import { splitCommand } from '../../swapper/native-swapper/library/index.js';

/** The clang invocation Xcode used for a file, for the architecture the simulator runs. */
export function extractClangCommand(
  log: string,
  { file, arch }: { file: string; arch: string },
): string[] | undefined {
  const lines = log.split('\n');

  for (let at = 0; at < lines.length; at++) {
    const line = lines[at] as string;
    if (!line.includes('CompileC') || !line.includes(file)) continue;

    const command = commandAfter(lines, at);
    if (!command) continue;

    const out = command[command.indexOf('-o') + 1];
    if (out?.includes(`/${arch}/`)) return command;
  }

  return undefined;
}

function commandAfter(lines: string[], at: number): string[] | undefined {
  for (let next = at + 1; next < Math.min(at + 6, lines.length); next++) {
    const line = (lines[next] as string).trim();

    if (line.includes('/clang') && line.includes('-x objective-c++')) {
      return splitCommand(line);
    }
  }

  return undefined;
}
