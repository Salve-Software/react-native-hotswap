import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { basename, join } from 'node:path';
import { tmpdir } from 'node:os';

/** Recompiles one Swift file into a dylib the running app can load. */
export function buildDylib(path, { sdk, target, search }) {
  const out = join(
    mkdtempSync(join(tmpdir(), 'hotswap-')),
    `${basename(path, '.swift')}.dylib`,
  );

  const args = [
    '-emit-library',
    '-o',
    out,
    '-sdk',
    sdk ?? simulatorSdk(),
    '-target',
    target ?? 'arm64-apple-ios15.1-simulator',
    '-Xfrontend',
    '-enable-implicit-dynamic',
    '-Xfrontend',
    '-enable-private-imports',
    '-Xfrontend',
    '-enable-dynamic-replacement-chaining',
  ];

  for (const directory of search ?? []) args.push('-I', directory, '-F', directory);

  args.push(path);

  execFileSync('swiftc', args, { stdio: 'pipe' });

  return out;
}

function simulatorSdk() {
  return execFileSync('xcrun', ['--sdk', 'iphonesimulator', '--show-sdk-path'], {
    encoding: 'utf8',
  }).trim();
}
