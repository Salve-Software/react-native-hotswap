import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { readGradleConfig } from './read-gradle-config.js';

/** Derives what to compile and where, overridable by hotswap.config.json. */
export function loadConfig(root) {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

  const defaults = {
    root,
    port: 8099,
    minApi: 24,
    buildTools: undefined,
    watch: join(root, 'android/src/main/java'),
    project: findGradle(root),
    task: `:${pkg.name}:compileDebugKotlin`,
    classes: join(root, 'android/build/tmp/kotlin-classes/debug'),
    specs: join(root, 'src/specs'),
    generated: join(root, 'nitrogen/generated'),
  };

  const file = join(root, 'hotswap.config.json');
  const overrides = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};

  for (const key of ['watch', 'project', 'classes', 'specs', 'generated']) {
    if (overrides[key]) overrides[key] = resolve(root, overrides[key]);
  }

  const merged = { ...defaults, ...fromGradle(defaults.project), ...overrides };

  return merged;
}

/** The build is the only source that knows how the installed APK was dexed. */
function fromGradle(project) {
  try {
    const { minApi, buildTools } = readGradleConfig(project);

    return Object.fromEntries(
      Object.entries({ minApi, buildTools }).filter(([, value]) => value !== undefined),
    );
  } catch {
    return {};
  }
}

/** Finds the gradle wrapper that owns the app. */
function findGradle(root) {
  const candidates = ['example/android', 'android', '../android'];

  for (const candidate of candidates) {
    const path = resolve(root, candidate);
    if (existsSync(join(path, 'gradlew'))) return path;
  }

  throw new Error('no gradlew found; set "project" in hotswap.config.json');
}
