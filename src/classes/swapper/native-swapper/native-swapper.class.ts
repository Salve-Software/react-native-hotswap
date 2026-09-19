import type { Outcome, SwapConfig, Swapper } from '../../../types/index.js';
import { dirname, join, relative } from 'node:path';
import { forwardPort, reason } from '../../../library/index.js';
import { Agent } from '../../agent/index.js';
import {
  buildSharedObject,
  findNativeLibrary,
  readCompileCommand,
  readSymbols,
  sendNative,
  splitCommand,
} from './library/index.js';

const REASONS: Record<number, string> = {
  1: 'the library would not load',
  2: 'nothing was redirected',
};

/** Replaces C++ in the running Android app, by branching each original at its entry. */
export class NativeSwapper implements Swapper {
  private readonly agent: Agent;

  constructor(private readonly config: SwapConfig) {
    this.agent = new Agent(config.port);
  }

  async swap(path: string): Promise<Outcome> {
    const started = Date.now();
    const name = relative(this.config.root, path);

    try {
      forwardPort(this.config.port);

      const entry = readCompileCommand(path, this.config);
      const nm = join(dirname(splitCommand(entry.command)[0] as string), 'llvm-nm');
      const original = findNativeLibrary(entry, this.config);
      const library = buildSharedObject(entry, original);

      // The room is the original's: an edit that grows a function would overstate it.
      const room = new Map(
        readSymbols(original, nm).map(({ name: at, size }) => [at, size]),
      );

      const symbols = readSymbols(library, nm)
        .filter(({ name: at }) => room.has(at))
        .map(({ name: at }) => ({ name: at, size: room.get(at) as number }));

      if (symbols.length === 0) {
        throw new Error('nothing in this file is already running; rebuild');
      }

      const status = await this.agent.send(sendNative(library, symbols));
      const took = Date.now() - started;

      console.log(
        status === 0
          ? `  ✅ ${name}  ${took}ms`
          : `  ❌ ${name}  ${REASONS[status] ?? `status ${status}`}  ${took}ms`,
      );

      return status === 0 ? 'swapped' : 'failed';
    } catch (cause) {
      console.log(`  ❌ ${name}  ${reason(cause)}`);

      return 'failed';
    }
  }
}
