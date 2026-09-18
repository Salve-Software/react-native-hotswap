import type { SwapConfig } from '../../../types/index.js';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { SWIFT_PATCH } from '../../../constants/index.js';
import { findSources } from '../../../library/index.js';
import { extractSwiftCommand } from './extract-swift-command.js';
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

// Xcode stopped supporting -dry-run, so the invocation comes from a real build and is kept.
function readSwiftCommand({
  workspace,
  scheme,
  derivedData,
  patchDir,
}: SwapConfig): string[] {
  const cache = join(tmpdir(), `hotswap-swift-${scheme}.json`);
  if (existsSync(cache)) return JSON.parse(readFileSync(cache, 'utf8')) as string[];

  // A build that recompiles nothing prints no invocation, so the patch file is touched to
  // make sure the module is one of the things this build has to do.
  const patch = join(patchDir, SWIFT_PATCH.file);
  writeFileSync(patch, SWIFT_PATCH.placeholder);

  const log = execFileSync(
    'xcodebuild',
    [
      '-workspace',
      workspace as string,
      '-scheme',
      scheme as string,
      '-configuration',
      'Debug',
      '-sdk',
      'iphonesimulator',
      '-derivedDataPath',
      derivedData as string,
      'build',
    ],
    { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 },
  );

  const args = extractSwiftCommand(log, scheme as string);
  if (!args)
    throw new Error(`the build never compiled ${scheme}; nothing to derive from`);

  writeFileSync(cache, JSON.stringify(args));

  return args;
}
