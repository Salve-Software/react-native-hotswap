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

/**
 * Turns a changed Swift or C++ file into a dylib the running app can adopt.
 *
 * The change is written into a file the pod already globs, so Xcode compiles it with the
 * settings the app was built with. Reproducing swiftc's invocation is the usual approach and
 * it drifts constantly.
 */
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
    // The object is already linked, and a failed build must not leave the change behind
    // either, so the developer's working tree stays clean between saves.
    writeFileSync(file, patch.placeholder);
  }
}

// CocoaPods globs sources at install time, so a file that appears later is invisible to the
// target until the next install. Creating every patch at once means one pod install covers
// both languages rather than one per language, on separate days.
function ensurePatches(patchDir: string): void {
  const missing = PATCHES.filter(({ file }) => !existsSync(join(patchDir, file)));
  if (missing.length === 0) return;

  for (const { file, placeholder } of missing) {
    writeFileSync(join(patchDir, file), placeholder);
  }

  const names = missing.map(({ file }) => file).join(' and ');

  throw new Error(`created ${names}; run pod install once, then save again`);
}

/** Only the patch object is linked: a dylib of the whole module loads a second copy of its
 * Swift metadata and takes the app down. */
function link(object: string, iosTarget: string): string {
  if (!existsSync(object)) throw new Error(`xcode produced no object at ${object}`);

  // dyld keys a loaded image on its install name, so a second dylib called patch.dylib comes
  // back as the handle of the first and the new file is never mapped. The name has to differ
  // on every swap.
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
