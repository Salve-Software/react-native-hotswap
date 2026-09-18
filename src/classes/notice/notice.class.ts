import type { Banner } from './types/index.js';
import type { Platform, SwapConfig } from '../../types/index.js';
import { basename } from 'node:path';
import { Agent } from '../agent/index.js';
import { REFRESHING, RELOADED } from './constants/index.js';
import { sendNotice } from './library/index.js';

/** Says on the device's screen, briefly, that its native code just changed. */
export class Notice {
  constructor(private readonly config: SwapConfig) {}

  swapped(path: string, platform: Platform): Promise<void> {
    return this.show({ title: REFRESHING, detail: basename(path) }, platform);
  }

  regenerated(path: string, platform: Platform): Promise<void> {
    const detail = `${basename(path)} · ${RELOADED}`;

    return this.show({ title: REFRESHING, detail }, platform);
  }

  private async show(banner: Banner, platform: Platform): Promise<void> {
    const port = platform === 'ios' ? this.config.iosPort : this.config.port;

    await new Agent(port).send(sendNotice(banner, platform)).catch(() => undefined);
  }
}
