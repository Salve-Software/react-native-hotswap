import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { tmpdir } from 'node:os';

/** Compiles the module and dexes the target class and its synthetic siblings, one dex each. */
export function buildDex({ className, project, task, classes, minApi, buildTools }) {
  execFileSync('./gradlew', [task, '-q'], {
    cwd: project,
    stdio: 'pipe',
    maxBuffer: 64 * 1024 * 1024,
  });

  const parts = className.split('/');
  const simple = parts.pop();
  const packageDir = join(classes, ...parts);

  if (!existsSync(packageDir)) throw new Error(`no compiled classes in ${packageDir}`);

  const targets = readdirSync(packageDir)
    .filter((f) => f === `${simple}.class` || f.startsWith(`${simple}$`))
    .map((f) => join(packageDir, f));

  if (targets.length === 0) throw new Error(`${simple}.class not found in ${packageDir}`);

  const out = mkdtempSync(join(tmpdir(), 'hotswap-'));
  execFileSync(
    dexer(buildTools),
    ['--min-api', String(minApi), '--file-per-class', '--output', out, ...targets],
    { stdio: 'pipe', maxBuffer: 64 * 1024 * 1024 },
  );

  return collectDexes(out);
}

/** ART accepts exactly one class def per redefinition, so each class travels in its own dex. */
function collectDexes(out) {
  const found = [];

  const walk = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);

      if (entry.isDirectory()) walk(path);
      else if (entry.name.endsWith('.dex')) {
        found.push({
          className: relative(out, path).slice(0, -4).split(sep).join('/'),
          dex: readFileSync(path),
        });
      }
    }
  };

  walk(out);

  return found;
}

/** d8 37 widens private lambda methods, which ART then refuses as a flag mismatch. */
function dexer(buildTools) {
  const sdk = process.env.ANDROID_HOME ?? join(process.env.HOME, 'Library/Android/sdk');
  const tools = join(sdk, 'build-tools');
  const installed = readdirSync(tools).sort();

  const chosen = installed.includes(buildTools)
    ? buildTools
    : installed.filter((v) => parseInt(v, 10) <= 36).pop();

  if (!chosen) throw new Error('no build-tools 36 or lower installed');

  return join(tools, chosen, 'd8');
}
