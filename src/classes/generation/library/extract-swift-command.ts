import { splitCommand } from '../../swapper/native-swapper/library/index.js';

/** The swiftc invocation Xcode used for a module, taken from a build log. */
export function extractSwiftCommand(
  log: string,
  moduleName: string,
): string[] | undefined {
  for (const line of log.split('\n')) {
    const at = line.indexOf('builtin-SwiftDriver -- ');
    if (at === -1) continue;

    const command = line.slice(at + 'builtin-SwiftDriver -- '.length);
    const args = splitCommand(command.replace(/\\=/g, '='));

    if (args[args.indexOf('-module-name') + 1] === moduleName) return args;
  }

  return undefined;
}
