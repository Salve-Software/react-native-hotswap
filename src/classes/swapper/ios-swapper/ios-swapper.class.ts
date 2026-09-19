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

    let dylib: string;
    try {
      dylib = buildDylib(path, this.config);
    } catch (cause) {
      // A patch only compiles against methods the running app has, so a build failure is the signal.
      console.log(`  ↻ ${name}  ${reason(cause)}`);

      return 'needs-generation';
    }

    try {
      let error = await this.agent.send(sendImage(dylib));

      // The refusal is what proves the app lacks something, and only then is it safe to send
      // the new file's own code: doing it first would define its types a second time.
      if (error !== 0 && this.lacksFiles()) {
        dylib = buildDylib(path, { ...this.config, carryNew: true });
        error = await this.agent.send(sendImage(dylib));
      }

      const took = Date.now() - started;

      if (error === 0) {
        console.log(`  ✅ ${name}  ${took}ms`);

        return 'swapped';
      }

      // A method added since install compiles here and has nothing to attach to there.
      console.log(`  ↻ ${name}  the running app has nothing to replace`);

      return 'needs-generation';
    } catch (cause) {
      console.log(`  ❌ ${name}  ${reason(cause)}`);

      return 'failed';
    }
  }

  private lacksFiles(): boolean {
    try {
      const built = builtSources(readBuildCommands(this.config));

      return (
        filesTheAppLacks(built, findSources(this.config.watch, ['.swift'])).length > 0
      );
    } catch {
      return false;
    }
  }
}
