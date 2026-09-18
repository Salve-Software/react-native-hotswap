import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { packageRoot } from '../../../library/package-root.js';

export function readGradleConfig(project: string): {
  minApi: number | undefined;
  buildTools: string | undefined;
} {
  const script = join(packageRoot(), 'gradle/hotswap-config.gradle');

  const output = execFileSync('./gradlew', ['-I', script, 'hotswapConfig', '-q'], {
    cwd: project,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });

  return {
    minApi: Number(match(output, 'HOTSWAP_MIN_SDK')) || undefined,
    buildTools: match(output, 'HOTSWAP_BUILD_TOOLS'),
  };
}

function match(output: string, key: string): string | undefined {
  return new RegExp(`^${key}=(.+)$`, 'm').exec(output)?.[1]?.trim();
}
