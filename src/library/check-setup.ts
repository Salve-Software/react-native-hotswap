import type { SwapConfig } from '../types/index.js';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { PATCHES } from '../constants/index.js';
import { readAgent } from './read-agent.js';

interface Answered {
  listening: boolean;
  app: string | undefined;
}

interface Reached {
  android: Answered;
  ios: Answered;
}

/** Reports what is wired up and what is missing, so setup fails loudly rather than silently. */
export function checkSetup(config: SwapConfig, reached: Reached): string[] {
  const lines = [
    report({
      what: 'gradle project',
      ok: existsSync(config.project),
      detail: config.project,
    }),
    report({
      what: 'kotlin sources',
      ok: existsSync(config.watch[0] ?? ''),
      detail: config.watch[0] ?? 'none',
    }),
    report({
      what: 'nitro spec',
      ok: true,
      detail: existsSync(config.specs) ? 'guard is active' : 'none, nothing to guard',
    }),
    report({ what: 'android device', ok: hasDevice(), detail: 'adb devices' }),
    report({
      what: 'agent reachable',
      ...readAgent(config.applicationId, { port: config.port, ...reached.android }),
    }),
    report({
      what: 'ios target',
      ok: Boolean(config.workspace && config.scheme),
      detail: describeTarget(config),
    }),
  ];

  if (config.workspace && config.scheme) {
    lines.push(
      report({
        what: 'ios loader',
        ...readAgent(undefined, { port: config.iosPort, ...reached.ios }),
      }),
      report({
        what: 'ios patch files',
        ok: missingPatches(config.patchDir).length === 0,
        detail: describePatches(config.patchDir),
      }),
    );
  }

  return lines;
}

function describeTarget({ workspace, scheme }: SwapConfig): string {
  if (!workspace) return 'no workspace found, android only';
  if (!scheme) return 'no podspec here; swift and c++ compile through a pod';

  return `${scheme} in ${workspace}`;
}

function missingPatches(patchDir: string): { file: string }[] {
  return PATCHES.filter(({ file }) => !existsSync(join(patchDir, file)));
}

function describePatches(patchDir: string): string {
  const missing = missingPatches(patchDir);

  return missing.length === 0
    ? 'present, pod install has seen them'
    : `${missing.map(({ file }) => file).join(' and ')} missing; run pod install`;
}

function report({
  what,
  ok,
  detail,
}: {
  what: string;
  ok: boolean;
  detail: string;
}): string {
  return `  ${ok ? '✅' : '⛔'} ${what.padEnd(18)} ${detail}`;
}

function hasDevice(): boolean {
  try {
    return (
      execFileSync('adb', ['devices'], { encoding: 'utf8' }).trim().split('\n').length > 1
    );
  } catch {
    return false;
  }
}
