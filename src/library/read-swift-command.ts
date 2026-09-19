import type { SwapConfig } from '../types/index.js';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { extractSwiftCommand } from '../classes/generation/library/extract-swift-command.js';
import { SWIFT_PATCH } from '../constants/index.js';

type Where = Pick<SwapConfig, 'workspace' | 'scheme' | 'derivedData' | 'patchDir'>;

function cacheFor(scheme: string): string {
  return join(tmpdir(), `hotswap-swift-${scheme}.json`);
}

export function forgetSwiftCommand(scheme: string): void {
  rmSync(cacheFor(scheme), { force: true });
}

// Xcode stopped supporting -dry-run, so the invocation comes from a real build and is kept.
export function readSwiftCommand({
  workspace,
  scheme,
  derivedData,
  patchDir,
}: Where): string[] {
  const cache = cacheFor(scheme as string);
  if (existsSync(cache)) return JSON.parse(readFileSync(cache, 'utf8')) as string[];

  // A build that recompiles nothing prints no invocation, so the patch file is touched.
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
