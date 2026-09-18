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

  /** Replaces one saved file on every platform that can take it. */
  async swap(path: string): Promise<boolean> {
    let swapped = false;

    for (const platform of await this.intendedFor(path)) {
      if (await this.swapperFor(platform, path).swap(path)) swapped = true;
    }

    return swapped;
  }

  /** Watches the project's native sources until the process ends. */
  watch(): void {
    const watched = this.config.watch
      .map((at) => relative(this.config.root, at))
      .join(', ');

    console.log(`hotswap  watching ${watched}`);

    new Watcher(this.config.watch, (path) => this.swap(path)).start();
  }

  /** Reports what is wired up, so setup fails loudly rather than at the first save. */
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

  /**
   * Narrows a shared file to the platforms actually running.
   *
   * A C++ file belongs to both, and someone developing against one simulator does not want
   * a failure line for the device they never started. A file only one platform can take is
   * left alone, so its own diagnosis is what gets printed.
   */
  private async intendedFor(path: string): Promise<Platform[]> {
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
