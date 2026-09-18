#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { checkSetup } from '../src/library/check-setup.js';
import { loadConfig } from '../src/library/load-config.js';
import { startWatching } from '../src/library/start-watching.js';
import { swapFile } from '../src/library/swap-file.js';

const argument = process.argv[2];
const check = argument === '--check';
const target = check ? undefined : argument;
const isFile = /\.(kt|swift)$/.test(target ?? '');
const path = target ? resolve(target) : process.cwd();
const config = loadConfig(isFile ? findRoot(path) : path);

forwardAndroidPort(config.port);

if (check) {
  console.log('hotswap  setup');
  for (const line of await checkSetup(config)) console.log(line);
  process.exit(0);
}

if (isFile) {
  process.exit((await swapFile(path, config)) ? 0 : 1);
}

startWatching(config);

function forwardAndroidPort(port) {
  try {
    execFileSync('adb', ['forward', `tcp:${port}`, `tcp:${port}`], { stdio: 'ignore' });
  } catch {
    // No device attached is normal when only iOS is in play.
  }
}

function findRoot(from) {
  let at = dirname(from);

  while (at !== '/' && !at.endsWith('/android')) at = dirname(at);

  return dirname(at);
}
