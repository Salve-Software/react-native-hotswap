import type { SwapConfig } from '../types/index.js';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  extractClangCommand,
  extractSwiftCommand,
} from '../classes/generation/library/index.js';
import { NATIVE_PATCH, PATCHES, SWIFT_PATCH } from '../constants/index.js';

interface Commands {
  swift: string[] | undefined;
  native: string[] | undefined;
}

type Where = Pick<
  SwapConfig,
  'workspace' | 'scheme' | 'derivedData' | 'patchDir' | 'arch'
>;

function cacheFor(scheme: string): string {
  return join(tmpdir(), `hotswap-commands-${scheme}.json`);
}

export function forgetBuildCommands(scheme: string): void {
  rmSync(cacheFor(scheme), { force: true });
}

export function readBuildCommands(where: Where): Commands {
  const cache = cacheFor(where.scheme as string);
  if (existsSync(cache)) return JSON.parse(readFileSync(cache, 'utf8')) as Commands;

  for (const { file, placeholder } of PATCHES) {
    writeFileSync(join(where.patchDir, file), placeholder);
  }

  const log = build(where);
  const commands: Commands = {
    swift: extractSwiftCommand(log, {
      moduleName: where.scheme as string,
      arch: where.arch,
    }),
    native: extractClangCommand(log, { file: NATIVE_PATCH.file, arch: where.arch }),
  };

  if (!commands.swift && !commands.native) {
    throw new Error(`the build never compiled ${where.scheme}; nothing to derive from`);
  }

  writeFileSync(cache, JSON.stringify(commands));

  return commands;
}

export function readSwiftCommand(where: Where): string[] {
  const { swift } = readBuildCommands(where);
  if (!swift) throw new Error(`the build never compiled ${where.scheme} as swift`);

  return swift;
}

function build({ workspace, scheme, derivedData }: Where): string {
  return execFileSync(
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
}

export { SWIFT_PATCH };
