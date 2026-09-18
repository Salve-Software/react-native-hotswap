import type { Outcome, SwapConfig, Swapper } from '../../../types/index.js';
import { relative } from 'node:path';
import { Agent } from '../../agent/index.js';
import { buildDylib, sendImage } from './library/index.js';

const REASONS: Record<number, string> = {
  1: 'dlopen failed',
  2: 'loaded but replaced nothing',
};

export class IosSwapper implements Swapper {
  private readonly agent: Agent;

  constructor(private readonly config: SwapConfig) {
    this.agent = new Agent(config.iosPort);
  }

  async swap(path: string): Promise<Outcome> {
    const started = Date.now();
    const name = relative(this.config.root, path);

    try {
      const dylib = buildDylib(path, this.config);
      const error = await this.agent.send(sendImage(dylib));
      const took = Date.now() - started;

      console.log(
        error === 0
          ? `  ✅ ${name}  ${took}ms`
          : `  ❌ ${name}  ${REASONS[error] ?? `status ${error}`}  ${took}ms`,
      );

      return error === 0 ? 'swapped' : 'failed';
    } catch (cause) {
      console.log(`  ❌ ${name}  ${(cause as Error).message.split('\n')[0]}`);

      return 'failed';
    }
  }
}
