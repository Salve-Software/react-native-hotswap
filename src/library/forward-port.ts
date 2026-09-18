import { execFileSync } from 'node:child_process';

/** A device that reconnected drops the forward, and the next swap would time out. */
export function forwardPort(port: number): void {
  try {
    execFileSync('adb', ['forward', `tcp:${port}`, `tcp:${port}`], { stdio: 'ignore' });
  } catch {
    // No device is a normal state when only iOS is in play.
  }
}
