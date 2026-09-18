import { execFileSync } from 'node:child_process';

const FALLBACK = 'arm64-v8a';

/** The ABI the attached device runs, which decides which build outputs to compile against. */
export function readDeviceAbi() {
  try {
    const abi = execFileSync('adb', ['shell', 'getprop', 'ro.product.cpu.abi'], {
      encoding: 'utf8',
    }).trim();

    return abi || FALLBACK;
  } catch {
    return FALLBACK;
  }
}
