import type { Platform, SwapConfig } from '../../types/index.js';
import { relative } from 'node:path';
import { forwardPort } from '../../library/index.js';
import { Agent } from '../agent/index.js';
import {
  buildGeneration,
  buildIosGeneration,
  readManifest,
  sendGeneration,
  sendIosGeneration,
} from './library/index.js';

export class Generation {
  private published = 0;

  constructor(private readonly config: SwapConfig) {}

  /**
   * Whether patching has stopped being able to reach this platform.
   *
   * An iOS generation is a module of its own, so its types are not the ones a replacement
   * names and a patch lands on classes nothing is using any more. ART has no such split: a
   * redefinition reaches every loaded copy, so Android keeps its fast path.
   */
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
      console.log(`  ❌ ${name}  ${(cause as Error).message.split('\n')[0]}`);

      return false;
    }
  }

  private forAndroid(): Promise<number> {
    forwardPort(this.config.port);

    const manifest = readManifest(this.config.watch);
    if (manifest.packages.length === 0) {
      throw new Error('no React package here to rebuild the module from');
    }

    return new Agent(this.config.port).send(
      sendGeneration(buildGeneration(this.config), manifest),
    );
  }

  // Every generation is its own Swift module, so the name has to differ each time or the
  // types would collide instead of standing beside each other.
  private forIos(): Promise<number> {
    const moduleName = `Hotswap${this.config.scheme}Gen${++this.published}`;
    const dylib = buildIosGeneration(this.config, moduleName);

    return new Agent(this.config.iosPort).send(sendIosGeneration(dylib));
  }
}
