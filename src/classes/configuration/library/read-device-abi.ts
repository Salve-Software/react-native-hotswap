import { execFileSync } from 'node:child_process';
import { FALLBACK_ABI } from '../constants/index.js';

export function readDeviceAbi(): string {
  try {
    const abi = execFileSync('adb', ['shell', 'getprop', 'ro.product.cpu.abi'], {
      encoding: 'utf8',
    }).trim();

    return abi || FALLBACK_ABI;
  } catch {
    return FALLBACK_ABI;
  }
}
