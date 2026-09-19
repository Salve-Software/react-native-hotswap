import type { Platform, SwapConfig } from '../../types/index.js';
import { relative } from 'node:path';
import { forwardPort, reason } from '../../library/index.js';
import { Agent } from '../agent/index.js';
import {
  buildGeneration,
  buildIosGeneration,
  readNativeBindings,
  readPackages,
  sendGeneration,
  sendIosGeneration,
} from './library/index.js';

export class Generation {
  private published = 0;

  constructor(private readonly config: SwapConfig) {}

  supersedesPatching(platform: Platform): boolean {
    return platform === 'ios' && this.published > 0;
  }

  async publish(path: string, platform: Platform): Promise<boolean> {
    const started = Date.now();
    const name = relative(this.config.root, path);

    try {
      const status = await (platform === 'ios' ? this.forIos() : this.forAndroid());
      const took = Date.now() - started;

      console.log(
        status === 0
          ? `  ♻️  ${name}  reloaded from a new generation  ${took}ms`
          : `  ❌ ${name}  the generation would not load  ${took}ms`,
      );

      return status === 0;
    } catch (cause) {
      console.log(`  ❌ ${name}  ${reason(cause)}`);

      return false;
    }
  }

  private forAndroid(): Promise<number> {
    forwardPort(this.config.port);

    const packages = readPackages(this.config.watch);
    if (packages.length === 0) {
      throw new Error('no React package here to rebuild the module from');
    }

    const dexes = buildGeneration(this.config);
    const shared = readNativeBindings(this.config.classes);

    return new Agent(this.config.port).send(sendGeneration(dexes, { packages, shared }));
  }

  private forIos(): Promise<number> {
    const moduleName = `Hotswap${this.config.scheme}Gen${this.published + 1}`;
    const dylib = buildIosGeneration(this.config, moduleName);

    this.published++;

    return new Agent(this.config.iosPort).send(sendIosGeneration(dylib));
  }
}
