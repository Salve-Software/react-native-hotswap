import type { SwapConfig } from '../types/index.js';
import { execFileSync } from 'node:child_process';

/** Runs the module's compile once, so the daemon is up and only the edit is left to do. */
export function warmGradle({
  project,
  task,
}: Pick<SwapConfig, 'project' | 'task'>): void {
  execFileSync('./gradlew', [task, '-q'], {
    cwd: project,
    stdio: 'pipe',
    maxBuffer: 64 * 1024 * 1024,
  });
}
