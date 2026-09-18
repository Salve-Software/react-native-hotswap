#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { loadConfig } from '../src/library/load-config.js';
import { startWatching } from '../src/library/start-watching.js';
import { swapFile } from '../src/library/swap-file.js';

const target = process.argv[2];
const isFile = target?.endsWith('.kt');
const path = target ? resolve(target) : process.cwd();
const config = loadConfig(isFile ? findRoot(path) : path);

execFileSync('adb', ['forward', `tcp:${config.port}`, `tcp:${config.port}`], {
  stdio: 'ignore',
});

if (isFile) {
  process.exit((await swapFile(path, config)) ? 0 : 1);
}

startWatching(config);

function findRoot(from) {
  let at = dirname(from);

  while (at !== '/' && !at.endsWith('/android')) at = dirname(at);

  return dirname(at);
}
