import { serialize } from '../../library/index.js';
import { watchSources } from './library/index.js';

/** Watches native sources and hands each settled edit on, one at a time. */
export class Watcher {
  private readonly queue = serialize();

  constructor(
    private readonly directories: string[],
    private readonly onChange: (path: string) => Promise<unknown>,
  ) {}

  start(): void {
    watchSources(this.directories, (path) => {
      void this.queue(() => this.onChange(path));
    });
  }
}
