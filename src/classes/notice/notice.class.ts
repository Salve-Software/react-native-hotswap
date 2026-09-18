import type { Platform, SwapConfig } from '../../types/index.js';
import { basename } from 'node:path';
import { Agent } from '../agent/index.js';
import { sendNotice } from './library/index.js';

/** Says on the device's screen, briefly, that its native code just changed. */
export class Notice {
  constructor(private readonly config: SwapConfig) {}

  swapped(path: string, platform: Platform): Promise<void> {
    return this.show(`hotswap · ${basename(path)}`, platform);
  }

  regenerated(path: string, platform: Platform): Promise<void> {
    return this.show(`hotswap · ${basename(path)} · reloaded`, platform);
  }

  private async show(text: string, platform: Platform): Promise<void> {
    const port = platform === 'ios' ? this.config.iosPort : this.config.port;

    await new Agent(port).send(sendNotice(text, platform)).catch(() => undefined);
  }
}
