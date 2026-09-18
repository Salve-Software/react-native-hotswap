#!/usr/bin/env node
import { resolve } from 'node:path'
import { startWatching } from '../src/library/start-watching.js'

startWatching(resolve(process.argv[2] ?? process.cwd()))
