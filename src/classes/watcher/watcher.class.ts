import { serialize } from '../../library/index.js';
import { watchSources } from './library/index.js';

export class Watcher {
  private readonly queue = serialize();

  constructor(
    private readonly directories: string[],
    private readonly onChange: (path: string) => Promise<unknown>,
  ) {}

  start(first?: () => Promise<unknown>): void {
    if (first) void this.queue(first);

    watchSources(this.directories, (path) => {
      void this.queue(() => this.onChange(path));
    });
  }
}
