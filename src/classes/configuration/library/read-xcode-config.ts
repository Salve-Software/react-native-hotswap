import { execFileSync } from 'node:child_process';

const INTERMEDIATES = '/Build/Intermediates.noindex';

/** Asks Xcode where it puts its objects, which is where the running app's came from. */
export function readXcodeConfig({
  workspace,
  scheme,
}: {
  workspace: string;
  scheme: string;
}): { derivedData?: string } {
  const output = execFileSync(
    'xcodebuild',
    [
      '-workspace',
      workspace,
      '-scheme',
      scheme,
      '-showBuildSettings',
      '-sdk',
      'iphonesimulator',
    ],
    {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      maxBuffer: 64 * 1024 * 1024,
    },
  );

  const objroot = /^\s+OBJROOT = (.+)$/m.exec(output)?.[1]?.trim();
  if (!objroot?.endsWith(INTERMEDIATES)) return {};

  return { derivedData: objroot.slice(0, -INTERMEDIATES.length) };
}
