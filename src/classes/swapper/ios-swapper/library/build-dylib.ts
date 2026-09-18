import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { PATCHES } from '../../../../constants/index.js';
import { patchFor } from './patch-for.js';
import type { Patch, SwapConfig } from '../../../../types/index.js';

type Where = Pick<
  SwapConfig,
  'workspace' | 'scheme' | 'derivedData' | 'arch' | 'iosTarget' | 'patchDir'
>;

export function buildDylib(
  path: string,
  { workspace, scheme, derivedData, arch, iosTarget, patchDir }: Where,
): string {
  const patch = patchFor(path, readFileSync(path, 'utf8'));
  if (!patch) throw new Error(`${basename(path)} declares no replaceable methods`);

  ensurePatches(patchDir);

  const file = join(patchDir, patch.file);
  writeFileSync(file, patch.contents);

  try {
    execFileSync(
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
      { stdio: 'pipe', maxBuffer: 64 * 1024 * 1024 },
    );

    return link(objectFor({ derivedData, scheme, arch, patch }), iosTarget);
  } finally {
    // The object is already linked, so the file can go back to being empty.
    writeFileSync(file, patch.placeholder);
  }
}

// CocoaPods globs at install time, so a file created later is invisible until the next one.
function ensurePatches(patchDir: string): void {
  const missing = PATCHES.filter(({ file }) => !existsSync(join(patchDir, file)));
  if (missing.length === 0) return;

  for (const { file, placeholder } of missing) {
    writeFileSync(join(patchDir, file), placeholder);
  }

  const names = missing.map(({ file }) => file).join(' and ');

  throw new Error(`created ${names}; run pod install once, then save again`);
}

// Linking the whole module would load a second copy of its Swift metadata and kill the app.
function link(object: string, iosTarget: string): string {
  if (!existsSync(object)) throw new Error(`xcode produced no object at ${object}`);

  // dyld keys a loaded image on its install name, so a reused name is never mapped again.
  const out = join(mkdtempSync(join(tmpdir(), 'hotswap-')), `patch-${Date.now()}.dylib`);

  execFileSync(
    'xcrun',
    [
      '-sdk',
      'iphonesimulator',
      'clang',
      '-dynamiclib',
      '-o',
      out,
      '-target',
      iosTarget,
      '-isysroot',
      simulatorSdk(),
      '-Xlinker',
      '-undefined',
      '-Xlinker',
      'dynamic_lookup',
      object,
    ],
    { stdio: 'pipe', maxBuffer: 64 * 1024 * 1024 },
  );

  return out;
}

function objectFor({
  derivedData,
  scheme,
  arch,
  patch,
}: Pick<Where, 'derivedData' | 'scheme' | 'arch'> & { patch: Patch }): string {
  return join(
    derivedData as string,
    'Build/Intermediates.noindex/Pods.build/Debug-iphonesimulator',
    `${scheme}.build/Objects-normal/${arch}`,
    patch.file.replace(/\.\w+$/, '.o'),
  );
}

function simulatorSdk(): string {
  return execFileSync('xcrun', ['--sdk', 'iphonesimulator', '--show-sdk-path'], {
    encoding: 'utf8',
  }).trim();
}
