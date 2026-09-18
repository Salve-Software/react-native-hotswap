import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync } from 'node:fs';
import { basename, join } from 'node:path';
import { tmpdir } from 'node:os';

/**
 * Rebuilds the pod through Xcode, then links the changed file's object into a dylib.
 *
 * Reproducing swiftc's invocation is the usual way to do this and it is a source of endless
 * drift; letting Xcode compile means the object already matches the running binary. Only the
 * one object is linked, because a dylib carrying the whole module loads a second copy of its
 * Swift metadata and takes the app down.
 */
export function buildDylib(path, { workspace, scheme, derivedData, arch, iosTarget }) {
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
    { stdio: 'pipe' },
  );

  const object = join(
    objectsDir(derivedData, scheme, arch),
    `${basename(path, '.swift')}.o`,
  );
  if (!existsSync(object))
    throw new Error(`xcode produced no object for ${basename(path)}`);

  const out = join(
    mkdtempSync(join(tmpdir(), 'hotswap-')),
    `${basename(path, '.swift')}.dylib`,
  );

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
    { stdio: 'pipe' },
  );

  return out;
}

function objectsDir(derivedData, scheme, arch) {
  return join(
    derivedData,
    'Build/Intermediates.noindex/Pods.build/Debug-iphonesimulator',
    `${scheme}.build/Objects-normal/${arch}`,
  );
}

function simulatorSdk() {
  return execFileSync('xcrun', ['--sdk', 'iphonesimulator', '--show-sdk-path'], {
    encoding: 'utf8',
  }).trim();
}
