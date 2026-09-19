import type { SwapConfig } from '../../../types/index.js';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { SWIFT_PATCH } from '../../../constants/index.js';
import { findSources, readSwiftCommand } from '../../../library/index.js';
import { generateFactory } from './generate-factory.js';
import { generationArgs } from './generation-args.js';

export function buildIosGeneration(config: SwapConfig, moduleName: string): string {
  const captured = readSwiftCommand(config);
  const out = join(mkdtempSync(join(tmpdir(), 'hotswap-')), `${moduleName}.dylib`);
  const patch = join(config.patchDir, SWIFT_PATCH.file);

  writeFileSync(patch, generateFactory(moduleSources(config, patch)));

  try {
    const args = generationArgs(captured, { moduleName, out });

    execFileSync(args[0] as string, args.slice(1), {
      cwd: join(dirname(config.workspace as string), 'Pods'),
      stdio: 'pipe',
      maxBuffer: 64 * 1024 * 1024,
    });

    return out;
  } finally {
    writeFileSync(patch, SWIFT_PATCH.placeholder);
  }
}

function moduleSources(config: SwapConfig, patch: string): string[] {
  return findSources(config.watch, ['.swift'])
    .filter((file) => file !== patch)
    .map((file) => readFileSync(file, 'utf8'));
}
