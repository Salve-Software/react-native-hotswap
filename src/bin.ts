#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { Hotswap } from './hotswap.class.js';
import { isSwappable } from './library/index.js';

const argument = process.argv[2];
const check = argument === '--check';
const target = check ? undefined : argument;
const isFile = target !== undefined && isSwappable(target);
const path = target ? resolve(target) : process.cwd();

const hotswap = new Hotswap(isFile ? findRoot(path) : path);

if (check) {
  console.log('hotswap  setup');
  for (const line of await hotswap.check()) console.log(line);
  process.exit(0);
}

if (isFile) {
  process.exit((await hotswap.swap(path)) ? 0 : 1);
}

hotswap.watch();

function findRoot(from: string): string {
  let at = dirname(from);

  while (at !== '/' && !existsSync(join(at, 'package.json'))) at = dirname(at);

  return at;
}
