import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const SCRIPT = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../gradle/hotswap-config.gradle',
);

/** Asks the app's gradle build which minSdk and build-tools produced the installed APK. */
export function readGradleConfig(project) {
  const output = execFileSync('./gradlew', ['-I', SCRIPT, 'hotswapConfig', '-q'], {
    cwd: project,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });

  return {
    minApi: Number(match(output, 'HOTSWAP_MIN_SDK')) || undefined,
    buildTools: match(output, 'HOTSWAP_BUILD_TOOLS'),
  };
}

function match(output, key) {
  return new RegExp(`^${key}=(.+)$`, 'm').exec(output)?.[1]?.trim();
}
