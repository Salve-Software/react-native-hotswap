import type { ClassDefinition, SwapConfig } from '../../../../types/index.js';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, sep } from 'node:path';
import { findDexer } from '../../../../library/find-dexer.js';

type Options = Pick<
  SwapConfig,
  'project' | 'task' | 'classes' | 'minApi' | 'buildTools'
> & {
  className: string;
};

/** Compiles the module and dexes the target class and its synthetic siblings, one dex each. */
export function buildDex({
  className,
  project,
  task,
  classes,
  minApi,
  buildTools,
}: Options): ClassDefinition[] {
  execFileSync('./gradlew', [task, '-q'], {
    cwd: project,
    stdio: 'pipe',
    maxBuffer: 64 * 1024 * 1024,
  });

  const parts = className.split('/');
  const simple = parts.pop() as string;
  const packageDir = join(classes, ...parts);

  if (!existsSync(packageDir)) throw new Error(`no compiled classes in ${packageDir}`);

  const targets = readdirSync(packageDir)
    .filter((f) => f === `${simple}.class` || f.startsWith(`${simple}$`))
    .map((f) => join(packageDir, f));

  if (targets.length === 0) throw new Error(`${simple}.class not found in ${packageDir}`);

  const out = mkdtempSync(join(tmpdir(), 'hotswap-'));
  execFileSync(
    findDexer(buildTools),
    ['--min-api', String(minApi), '--file-per-class', '--output', out, ...targets],
    { stdio: 'pipe', maxBuffer: 64 * 1024 * 1024 },
  );

  return collectDexes(out);
}

// ART accepts exactly one class def per redefinition.
function collectDexes(out: string): ClassDefinition[] {
  const found: ClassDefinition[] = [];

  const walk = (directory: string): void => {
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
