import { relative } from 'node:path';
import { Agent } from '../../agent/index.js';
import { forwardPort } from '../../../library/index.js';
import type { Outcome, SwapConfig, Swapper } from '../../../types/index.js';
import {
  buildDex,
  explainJvmtiError,
  needsGeneration,
  findStaleSpec,
  readClassName,
  sendRedefinition,
} from './library/index.js';

/** Replaces a Kotlin class in the running app, through ART's own redefinition. */
export class KotlinSwapper implements Swapper {
  private readonly agent: Agent;

  constructor(private readonly config: SwapConfig) {
    this.agent = new Agent(config.port);
  }

  async swap(path: string): Promise<Outcome> {
    const started = Date.now();
    const name = relative(this.config.root, path);

    const stale = findStaleSpec(this.config.specs, this.config.generated);
    if (stale) {
      const spec = relative(this.config.root, stale);
      console.log(`  ⛔ ${name}  ${spec} changed; run codegen and rebuild`);

      return 'failed';
    }

    try {
      forwardPort(this.config.port);

      const className = readClassName(path);
      const definitions = buildDex({ className, ...this.config });
      const error = await this.agent.send(sendRedefinition(definitions));
      const took = Date.now() - started;
      const extra = definitions.length > 1 ? ` +${definitions.length - 1}` : '';

      if (error === 0) {
        console.log(`  ✅ ${name}${extra}  ${took}ms`);

        return 'swapped';
      }

      if (needsGeneration(error)) {
        console.log(`  ↻ ${name}  ${explainJvmtiError(error)}`);

        return 'needs-generation';
      }

      console.log(`  ❌ ${name}  ${explainJvmtiError(error)}  ${took}ms`);

      return 'failed';
    } catch (cause) {
      console.log(`  ❌ ${name}  ${(cause as Error).message.split('\n')[0]}`);

      return 'failed';
    }
  }
}
