import type { Patch, SwapConfig } from '../../../../types/index.js';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { PATCHES } from '../../../../constants/index.js';
import { findSources } from '../../../../library/index.js';
import { forgetBuildCommands, readBuildCommands } from '../../../../library/index.js';
import { builtSources } from './built-sources.js';
import { filesTheAppLacks } from './files-the-app-lacks.js';
import { nativeArgs } from './native-args.js';
import { patchArgs } from './patch-args.js';
import { patchFor } from './patch-for.js';

type Where = Pick<
  SwapConfig,
  'workspace' | 'scheme' | 'derivedData' | 'arch' | 'iosTarget' | 'patchDir' | 'watch'
> & { carryNew?: boolean };

export function buildDylib(path: string, where: Where): string {
  const { iosTarget, patchDir } = where;
  const patch = patchFor(path, readFileSync(path, 'utf8'));
  if (!patch) throw new Error(`${basename(path)} declares no replaceable methods`);

  ensurePatches(patchDir);

  const file = join(patchDir, patch.file);
  writeFileSync(file, patch.contents);

  try {
    const objects = replayed(where, patch) ?? [throughXcode(where, patch)];

    return link(objects, iosTarget);
  } finally {
    // The object is already linked, so the file can go back to being empty.
    writeFileSync(file, patch.placeholder);
  }
}

// Xcode reparses React Native's module maps on every build, which is where its seconds go.
// The captured invocation with a module cache that survives does the same work in a fifth of
// a second, and xcodebuild stays as the answer for when the capture no longer fits.
function replayed(where: Where, patch: Patch): string[] | undefined {
  try {
    const captured = readBuildCommands(where);
    const swift = patch.file.endsWith('.swift');
    const out = mkdtempSync(join(tmpdir(), 'hotswap-'));
    const cache = join(tmpdir(), `hotswap-modules-${where.scheme}`);
    mkdirSync(cache, { recursive: true });

    const args = swift
      ? swiftReplay(captured.swift, { out, cache, where })
      : nativeReplay(captured.native, { object: join(out, 'patch.o'), cache });
    if (!args) return undefined;

    execFileSync(args[0] as string, args.slice(1), {
      cwd: join(dirname(where.workspace as string), 'Pods'),
      stdio: 'pipe',
      maxBuffer: 64 * 1024 * 1024,
    });

    const object = swift
      ? join(out, patch.file.replace(/\.\w+$/, '.o'))
      : join(out, 'patch.o');
    if (!existsSync(object)) return undefined;

    return [object, ...(swift ? carried(where, { captured: captured.swift, out }) : [])];
  } catch {
    forgetBuildCommands(where.scheme as string);

    return undefined;
  }
}

function swiftReplay(
  captured: string[] | undefined,
  { out, cache, where }: { out: string; cache: string; where: Where },
): string[] | undefined {
  if (!captured) return undefined;

  const built = builtSources({ swift: captured });
  if (built.length === 0) return undefined;

  const extra = filesTheAppLacks(built, findSources(where.watch, ['.swift']));
  const sources = [...built, ...extra];

  const map = join(out, 'output-file-map.json');
  writeFileSync(map, JSON.stringify(objectMap(sources, out)));

  return [...patchArgs(captured, { map, cache }), ...extra];
}

// Only after the app has refused: linking a file it already has would give its Swift
// metadata a second definition, and the app goes down instead of swapping.
function carried(
  where: Where,
  { captured, out }: { captured: string[] | undefined; out: string },
): string[] {
  if (!where.carryNew || !captured) return [];

  const built = builtSources({ swift: captured });

  return filesTheAppLacks(built, findSources(where.watch, ['.swift']))
    .map((file) => join(out, basename(file).replace(/\.\w+$/, '.o')))
    .filter((object) => existsSync(object));
}

function nativeReplay(
  captured: string[] | undefined,
  { object, cache }: { object: string; cache: string },
): string[] | undefined {
  return captured ? nativeArgs(captured, { object, cache }) : undefined;
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
function link(objects: string[], iosTarget: string): string {
  for (const object of objects) {
    if (!existsSync(object)) throw new Error(`xcode produced no object at ${object}`);
  }

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
      ...objects,
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
