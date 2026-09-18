import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

/** Compiles the target class and its synthetic siblings into one dex. */
export function buildDex({ className, project, task, classes }) {
  execFileSync('./gradlew', [task, '-q'], { cwd: project, stdio: 'pipe' });

  const parts = className.split('/');
  const simple = parts.pop();
  const packageDir = join(classes, ...parts);

  if (!existsSync(packageDir)) throw new Error(`no compiled classes in ${packageDir}`);

  const targets = readdirSync(packageDir)
    .filter((f) => f === `${simple}.class` || f.startsWith(`${simple}$`))
    .map((f) => join(packageDir, f));

  if (targets.length === 0) throw new Error(`${simple}.class not found in ${packageDir}`);

  const out = mkdtempSync(join(tmpdir(), 'hotswap-'));
  execFileSync(dexer(), ['--min-api', '28', '--output', out, ...targets], {
    stdio: 'pipe',
  });

  return { dex: readFileSync(join(out, 'classes.dex')), classCount: targets.length };
}

function dexer() {
  const sdk = process.env.ANDROID_HOME ?? join(process.env.HOME, 'Library/Android/sdk');
  const tools = join(sdk, 'build-tools');

  return join(tools, readdirSync(tools).sort().pop(), 'd8');
}
