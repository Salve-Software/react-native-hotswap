import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { tmpdir } from 'node:os';
import { generateSwiftReplacement } from './generate-swift-replacement.js';

const PATCH = 'HotswapPatch.swift';
const PLACEHOLDER = 'import Foundation\n';

/**
 * Turns a changed Swift file into a dylib the running app can adopt.
 *
 * The change is written as an extension of dynamic replacements into a file the pod already
 * globs, so Xcode compiles it with the settings the app was built with. Reproducing swiftc's
 * invocation is the usual approach and it drifts constantly.
 */
export function buildDylib(
  path,
  { workspace, scheme, derivedData, arch, iosTarget, patchDir },
) {
  const replacement = generateSwiftReplacement(readFileSync(path, 'utf8'));
  if (!replacement) throw new Error(`${basename(path)} declares no replaceable methods`);

  const patch = join(patchDir, PATCH);

  // CocoaPods globs sources at install time, so a file that appears later is invisible to
  // the target until the next install. Creating it is cheap; telling the developer is not.
  if (!existsSync(patch)) {
    writeFileSync(patch, PLACEHOLDER);

    throw new Error(`created ${PATCH}; run pod install once, then save again`);
  }

  writeFileSync(patch, replacement);

  execFileSync(
    'xcodebuild',
    [
      '-workspace',
      workspace,
      '-scheme',
      scheme,
      '-configuration',
      'Debug',
      '-sdk',
      'iphonesimulator',
      '-derivedDataPath',
      derivedData,
      'build',
    ],
    { stdio: 'pipe', maxBuffer: 64 * 1024 * 1024 },
  );

  try {
    return link(objectFor(derivedData, scheme, arch), iosTarget);
  } finally {
    // The object is already linked, so the file can go back to being empty and the
    // developer's working tree stays clean between saves.
    writeFileSync(patch, PLACEHOLDER);
  }
}

/** Only the patch object is linked: a dylib of the whole module loads a second copy of its
 * Swift metadata and takes the app down. */
function link(object, iosTarget) {
  if (!existsSync(object)) throw new Error(`xcode produced no object at ${object}`);

  const out = join(mkdtempSync(join(tmpdir(), 'hotswap-')), 'patch.dylib');

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

function objectFor(derivedData, scheme, arch) {
  return join(
    derivedData,
    'Build/Intermediates.noindex/Pods.build/Debug-iphonesimulator',
    `${scheme}.build/Objects-normal/${arch}`,
    PATCH.replace('.swift', '.o'),
  );
}

function simulatorSdk() {
  return execFileSync('xcrun', ['--sdk', 'iphonesimulator', '--show-sdk-path'], {
    encoding: 'utf8',
  }).trim();
}
