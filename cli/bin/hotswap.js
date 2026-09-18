#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { loadConfig } from '../src/library/load-config.js';
import { startWatching } from '../src/library/start-watching.js';
import { swapFile } from '../src/library/swap-file.js';

const target = process.argv[2];
const isFile = /\.(kt|swift)$/.test(target ?? '');
const path = target ? resolve(target) : process.cwd();
const config = loadConfig(isFile ? findRoot(path) : path);

forwardAndroidPort(config.port);

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
