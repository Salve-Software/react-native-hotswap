import type { Outcome, SwapConfig, Swapper } from '../../../types/index.js';
import { relative } from 'node:path';
import { Agent } from '../../agent/index.js';
import { buildDylib, sendImage } from './library/index.js';

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
      // A replacement only compiles against methods the running app already has, so a patch
      // that will not build is how a new method or a new file announces itself here.
      console.log(`  ↻ ${name}  ${(cause as Error).message.split('\n')[0]}`);

      return 'needs-generation';
    }

    try {
      const error = await this.agent.send(sendImage(dylib));
      const took = Date.now() - started;

      if (error === 0) {
        console.log(`  ✅ ${name}  ${took}ms`);

        return 'swapped';
      }

      // A patch is compiled against the source as it is now, so a method added since the app
      // was installed compiles here and then has nothing to attach to there — it either
      // refuses to load or replaces nothing. Either way the app is the one that knows.
      console.log(`  ↻ ${name}  the running app has nothing to replace`);

      return 'needs-generation';
    } catch (cause) {
      console.log(`  ❌ ${name}  ${(cause as Error).message.split('\n')[0]}`);

      return 'failed';
    }
  }
}
