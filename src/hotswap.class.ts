import { relative } from 'node:path';
import {
  Agent,
  Configuration,
  Generation,
  IosSwapper,
  KotlinSwapper,
  NativeSwapper,
  Watcher,
} from './classes/index.js';
import { HEADERS } from './constants/index.js';
import {
  checkSetup,
  findDependents,
  findSources,
  forwardPort,
  platformsFor,
} from './library/index.js';
import type { Outcome, Platform, SwapConfig, Swapper } from './types/index.js';

export class Hotswap {
  readonly config: SwapConfig;

  private readonly kotlin: KotlinSwapper;
  private readonly native: NativeSwapper;
  private readonly ios: IosSwapper;
  private readonly generation: Generation;

  constructor(root: string) {
    this.config = Configuration.load(root);
    this.kotlin = new KotlinSwapper(this.config);
    this.native = new NativeSwapper(this.config);
    this.ios = new IosSwapper(this.config);
    this.generation = new Generation(this.config);
  }

  async swap(path: string): Promise<boolean> {
    return HEADERS.some((end) => path.endsWith(end))
      ? this.swapDependents(path)
      : this.swapOne(path);
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

  private async swapDependents(header: string): Promise<boolean> {
    const name = relative(this.config.root, header);
    const dependents = findDependents(header, findSources(this.config.watch));

    if (dependents.length === 0) {
      console.log(`  ⛔ ${name}  nothing watched includes it`);

      return false;
    }

    console.log(`  ↳ ${name}  included by ${dependents.length}`);

    let swapped = false;
    for (const dependent of dependents) {
      if (await this.swapOne(dependent)) swapped = true;
    }

    return swapped;
  }

  private async swapOne(path: string): Promise<boolean> {
    let swapped = false;

    for (const platform of await this.intendedFor(path)) {
      const outcome: Outcome = await this.swapperFor(platform, path).swap(path);

      if (outcome === 'swapped') swapped = true;
      if (outcome === 'needs-generation' && (await this.generation.publish(path))) {
        swapped = true;
      }
    }

    return swapped;
  }

  private swapperFor(platform: Platform, path: string): Swapper {
    if (platform === 'ios') return this.ios;

    return path.endsWith('.kt') ? this.kotlin : this.native;
  }

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
