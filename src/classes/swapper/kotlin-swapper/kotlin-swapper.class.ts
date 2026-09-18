import { relative } from 'node:path';
import { Agent } from '../../agent/index.js';
import { forwardPort } from '../../../library/index.js';
import type { SwapConfig, Swapper } from '../../../types/index.js';
import {
  buildDex,
  explainJvmtiError,
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

  async swap(path: string): Promise<boolean> {
    const started = Date.now();
    const name = relative(this.config.root, path);

    const stale = findStaleSpec(this.config.specs, this.config.generated);
    if (stale) {
      const spec = relative(this.config.root, stale);
      console.log(`  ⛔ ${name}  ${spec} changed; run codegen and rebuild`);

      return false;
    }

    try {
      forwardPort(this.config.port);

      const className = readClassName(path);
      const definitions = buildDex({ className, ...this.config });
      const error = await this.agent.send(sendRedefinition(definitions));
      const took = Date.now() - started;
      const extra = definitions.length > 1 ? ` +${definitions.length - 1}` : '';

      console.log(
        error === 0
          ? `  ✅ ${name}${extra}  ${took}ms`
          : `  ❌ ${name}  ${explainJvmtiError(error)}  ${took}ms`,
      );

      return error === 0;
    } catch (cause) {
      console.log(`  ❌ ${name}  ${(cause as Error).message.split('\n')[0]}`);

      return false;
    }
  }
}
