import { readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

/** d8 37 widens private lambda methods, which ART refuses as a flag mismatch. */
export function findDexer(buildTools: string | undefined): string {
  const sdk = process.env['ANDROID_HOME'] ?? join(homedir(), 'Library/Android/sdk');
  const tools = join(sdk, 'build-tools');
  const installed = readdirSync(tools).sort();

  const chosen =
    buildTools && installed.includes(buildTools)
      ? buildTools
      : installed.filter((v) => parseInt(v, 10) <= 36).pop();

  if (!chosen) throw new Error('no build-tools 36 or lower installed');

  return join(tools, chosen, 'd8');
}
