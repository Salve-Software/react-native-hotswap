import type { Outcome, SwapConfig, Swapper } from '../../../types/index.js';
import { relative } from 'node:path';
import { findSources, readBuildCommands, reason } from '../../../library/index.js';
import { Agent } from '../../agent/index.js';
import {
  buildDylib,
  builtSources,
  filesTheAppLacks,
  sendImage,
} from './library/index.js';

export class IosSwapper implements Swapper {
  private readonly agent: Agent;

  constructor(private readonly config: SwapConfig) {
    this.agent = new Agent(config.iosPort);
  }

  async swap(path: string): Promise<Outcome> {
    const started = Date.now();
    const name = relative(this.config.root, path);

    if (this.isNewHere(path)) {
      console.log(`  ↷ ${name}  new here; it swaps once something loaded calls it`);

      return 'nothing-to-swap';
    }

    let dylib: string;
    try {
      dylib = buildDylib(path, this.config);
    } catch (cause) {
      console.log(`  ↻ ${name}  ${reason(cause)}`);

      return 'needs-generation';
    }

    try {
      let error = await this.agent.send(sendImage(dylib));

      if (error !== 0 && this.lacksFiles()) {
        dylib = buildDylib(path, { ...this.config, carryNew: true });
        error = await this.agent.send(sendImage(dylib));
      }

      const took = Date.now() - started;

      if (error === 0) {
        console.log(`  ✅ ${name}  ${took}ms`);

        return 'swapped';
      }

      console.log(`  ↻ ${name}  the running app has nothing to replace`);

      return 'needs-generation';
    } catch (cause) {
      console.log(`  ❌ ${name}  ${reason(cause)}`);

      return 'failed';
    }
  }

  private isNewHere(path: string): boolean {
    return path.endsWith('.swift') && this.lacking().includes(path);
  }

  private lacksFiles(): boolean {
    return this.lacking().length > 0;
  }

  private lacking(): string[] {
    try {
      const built = builtSources(readBuildCommands(this.config));

      return filesTheAppLacks(built, findSources(this.config.watch, ['.swift']));
    } catch {
      return [];
    }
  }
}
