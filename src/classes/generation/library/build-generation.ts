import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { findDexer, findSources } from '../../../library/index.js';
import type { SwapConfig } from '../../../types/index.js';

export function buildGeneration(config: SwapConfig): Buffer[] {
  execFileSync('./gradlew', [config.task, '-q'], {
    cwd: config.project,
    stdio: 'pipe',
    maxBuffer: 64 * 1024 * 1024,
  });

  const classes = findSources([config.classes], ['.class']);
  if (classes.length === 0) throw new Error(`no compiled classes in ${config.classes}`);

  const out = mkdtempSync(join(tmpdir(), 'hotswap-'));

  execFileSync(
    findDexer(config.buildTools),
    ['--min-api', String(config.minApi), '--output', out, ...classes],
    { stdio: 'pipe', maxBuffer: 64 * 1024 * 1024 },
  );

  return findSources([out], ['.dex']).map((dex) => readFileSync(dex));
}
