import type { Patch, SwapConfig } from '../../../../types/index.js';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { PATCHES } from '../../../../constants/index.js';
import { forgetSwiftCommand, readSwiftCommand } from '../../../../library/index.js';
import { patchArgs, sourceListPath } from './patch-args.js';
import { patchFor } from './patch-for.js';

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

  const where = { workspace, scheme, derivedData, arch, iosTarget, patchDir };

  try {
    return link(replayed(where, patch) ?? throughXcode(where, patch), iosTarget);
  } finally {
    // The object is already linked, so the file can go back to being empty.
    writeFileSync(file, patch.placeholder);
  }
}

// Xcode reparses React Native's module maps on every build, which is where its seconds go.
// The captured invocation with a module cache that survives does the same work in a fifth of
// a second, and xcodebuild stays as the answer for when the capture no longer fits.
function replayed(where: Where, patch: Patch): string | undefined {
  if (!patch.file.endsWith('.swift')) return undefined;

  try {
    const captured = readSwiftCommand(where);
    const list = sourceListPath(captured);
    if (!list) return undefined;

    const out = mkdtempSync(join(tmpdir(), 'hotswap-'));
    const cache = join(tmpdir(), `hotswap-modules-${where.scheme}`);
    mkdirSync(cache, { recursive: true });

    const sources = readFileSync(list, 'utf8')
      .split('\n')
      .map((line) => line.trim().replace(/^"|"$/g, ''))
      .filter(Boolean);

    const map = join(out, 'output-file-map.json');
    writeFileSync(map, JSON.stringify(objectMap(sources, out)));

    const args = patchArgs(captured, { map, cache });
    execFileSync(args[0] as string, args.slice(1), {
      cwd: join(dirname(where.workspace as string), 'Pods'),
      stdio: 'pipe',
      maxBuffer: 64 * 1024 * 1024,
    });

    const object = join(out, patch.file.replace(/\.\w+$/, '.o'));

    return existsSync(object) ? object : undefined;
  } catch {
    forgetSwiftCommand(where.scheme as string);

    return undefined;
  }
}

function objectMap(sources: string[], out: string): Record<string, unknown> {
  const map: Record<string, unknown> = { '': {} };

  for (const source of sources) {
    map[source] = { object: join(out, basename(source).replace(/\.\w+$/, '.o')) };
  }

  return map;
}

function throughXcode(where: Where, patch: Patch): string {
  execFileSync(
    'xcodebuild',
    [
      '-workspace',
      where.workspace as string,
      '-scheme',
      where.scheme as string,
      '-configuration',
      'Debug',
      '-sdk',
      'iphonesimulator',
      '-derivedDataPath',
      where.derivedData as string,
      'build',
    ],
    { stdio: 'pipe', maxBuffer: 64 * 1024 * 1024 },
  );

  return objectFor({ ...where, patch });
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
