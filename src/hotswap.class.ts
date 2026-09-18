import { relative } from 'node:path';
import {
  Agent,
  Configuration,
  IosSwapper,
  KotlinSwapper,
  NativeSwapper,
  Watcher,
} from './classes/index.js';
import { checkSetup, forwardPort, platformsFor } from './library/index.js';
import type { Platform, SwapConfig, Swapper } from './types/index.js';

/** The one entry point: reads a project's layout and swaps what it saves into the running app. */
export class Hotswap {
  readonly config: SwapConfig;

  private readonly kotlin: KotlinSwapper;
  private readonly native: NativeSwapper;
  private readonly ios: IosSwapper;

  constructor(root: string) {
    this.config = Configuration.load(root);
    this.kotlin = new KotlinSwapper(this.config);
    this.native = new NativeSwapper(this.config);
    this.ios = new IosSwapper(this.config);
  }

  async swap(path: string): Promise<boolean> {
    let swapped = false;

    for (const platform of await this.intendedFor(path)) {
      if (await this.swapperFor(platform, path).swap(path)) swapped = true;
    }

    return swapped;
  }

  watch(): void {
    const watched = this.config.watch
      .map((at) => relative(this.config.root, at))
      .join(', ');

    console.log(`hotswap  watching ${watched}`);

    new Watcher(this.config.watch, (path) => this.swap(path)).start();
  }

  async check(): Promise<string[]> {
    forwardPort(this.config.port);

    const [android, ios] = await Promise.all([
      new Agent(this.config.port).listening(),
      new Agent(this.config.iosPort).listening(),
    ]);

    return checkSetup(this.config, { android, ios });
  }

  private swapperFor(platform: Platform, path: string): Swapper {
    if (platform === 'ios') return this.ios;

    return path.endsWith('.kt') ? this.kotlin : this.native;
  }

  private async intendedFor(path: string): Promise<Platform[]> {
    // Only a shared file narrows; a single-platform file keeps its own diagnosis.
    const platforms = platformsFor(path);
    if (platforms.length < 2) return platforms;

    forwardPort(this.config.port);

    const listening = await Promise.all([
      new Agent(this.config.port).listening(),
      new Agent(this.config.iosPort).listening(),
    ]);

    return platforms.filter((_, at) => listening[at]);
  }
}
