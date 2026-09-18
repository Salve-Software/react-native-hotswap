import type { SwapConfig, SwapOverrides } from '../../types/index.js';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { ANDROID_PORT, IOS_PORT } from '../../constants/index.js';
import { CONFIG_FILE } from './constants/index.js';
import {
  findPodName,
  findWorkspace,
  gradleProjectName,
  readDeviceAbi,
  readGradleConfig,
  readXcodeConfig,
  resolveOverrides,
} from './library/index.js';

export class Configuration {
  static load(root: string): SwapConfig {
    const defaults = Configuration.defaults(root);
    const file = join(root, CONFIG_FILE);
    const written: SwapOverrides = existsSync(file)
      ? (JSON.parse(readFileSync(file, 'utf8')) as SwapOverrides)
      : {};

    return {
      ...defaults,
      ...Configuration.fromGradle(defaults.project),
      ...Configuration.fromXcode(defaults),
      ...resolveOverrides(root, written),
    };
  }

  private static defaults(root: string): SwapConfig {
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
      name: string;
    };
    const app = Configuration.isApp(root);

    return {
      root,
      port: ANDROID_PORT,
      iosPort: IOS_PORT,
      minApi: 24,
      buildTools: undefined,
      abi: readDeviceAbi(),
      watch: app
        ? [join(root, 'android/app/src/main/java')]
        : [
            join(root, 'android/src/main/java'),
            join(root, 'android/src/main/cpp'),
            join(root, 'ios'),
            join(root, 'cpp'),
          ],
      project: Configuration.findGradle(root),
      task: app
        ? ':app:compileDebugKotlin'
        : `:${gradleProjectName(pkg.name)}:compileDebugKotlin`,
      classes: app
        ? join(root, 'android/app/build/tmp/kotlin-classes/debug')
        : join(root, 'android/build/tmp/kotlin-classes/debug'),
      workspace: findWorkspace(root),
      scheme: findPodName(root),
      derivedData: undefined,
      patchDir: join(root, 'ios'),
      arch: 'arm64',
      iosTarget: 'arm64-apple-ios15.1-simulator',
      specs: join(root, 'src/specs'),
      generated: join(root, 'nitrogen/generated'),
    };
  }

  private static fromXcode({ workspace, scheme }: SwapConfig): Partial<SwapConfig> {
    if (!workspace || !scheme) return {};

    try {
      return readXcodeConfig({ workspace, scheme });
    } catch {
      return {};
    }
  }

  private static fromGradle(project: string): Partial<SwapConfig> {
    try {
      const { minApi, buildTools } = readGradleConfig(project);

      return Object.fromEntries(
        Object.entries({ minApi, buildTools }).filter(([, value]) => value !== undefined),
      );
    } catch {
      return {};
    }
  }

  private static isApp(root: string): boolean {
    return (
      existsSync(join(root, 'android/app/src/main/java')) &&
      !existsSync(join(root, 'android/src/main/java'))
    );
  }

  private static findGradle(root: string): string {
    for (const candidate of ['example/android', 'android', '../android']) {
      const path = resolve(root, candidate);
      if (existsSync(join(path, 'gradlew'))) return path;
    }

    throw new Error('no gradlew found; set "project" in hotswap.config.json');
  }
}
