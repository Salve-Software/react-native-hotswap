import { relative } from 'node:path';
import { Agent } from '../agent/index.js';
import { forwardPort } from '../../library/index.js';
import type { SwapConfig } from '../../types/index.js';
import { buildGeneration, readManifest, sendGeneration } from './library/index.js';

export class Generation {
  private readonly agent: Agent;

  constructor(private readonly config: SwapConfig) {
    this.agent = new Agent(config.port);
  }

  async publish(path: string): Promise<boolean> {
    const started = Date.now();
    const name = relative(this.config.root, path);

    try {
      forwardPort(this.config.port);

      const manifest = readManifest(this.config.watch);
      if (manifest.packages.length === 0) {
        throw new Error('no React package here to rebuild the module from');
      }

      const dexes = buildGeneration(this.config);
      const status = await this.agent.send(sendGeneration(dexes, manifest));
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
}
