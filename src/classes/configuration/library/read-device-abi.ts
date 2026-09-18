import { execFileSync } from 'node:child_process';

const FALLBACK = 'arm64-v8a';

export function readDeviceAbi(): string {
  try {
    const abi = execFileSync('adb', ['shell', 'getprop', 'ro.product.cpu.abi'], {
      encoding: 'utf8',
    }).trim();

    return abi || FALLBACK;
  } catch {
    return FALLBACK;
  }
}
