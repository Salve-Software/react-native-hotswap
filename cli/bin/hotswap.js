#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { buildDex } from '../src/library/build-dex.js'
import { resolveClassName } from '../src/library/resolve-class-name.js'
import { sendRedefinition } from '../src/library/send-redefinition.js'

const [, , file] = process.argv

if (!file) {
  console.error('usage: hotswap <path/to/File.kt>')
  process.exit(1)
}

const config = {
  port: Number(process.env.HOTSWAP_PORT ?? 8099),
  project: process.env.HOTSWAP_PROJECT ?? '.',
  gradleTask: process.env.HOTSWAP_TASK ?? '',
  classesDir: process.env.HOTSWAP_CLASSES ?? '',
}

const className = resolveClassName(resolve(file))
console.log(`class   ${className}`)

const { dex, classCount } = buildDex({ className, ...config })
console.log(`dex     ${dex.length} bytes, ${classCount} class(es)`)

execFileSync('adb', ['forward', `tcp:${config.port}`, `tcp:${config.port}`], { stdio: 'ignore' })

const error = await sendRedefinition({ className, dex }, config.port)
console.log(error === 0 ? 'swapped ✅' : `failed  ❌ jvmtiError ${error}`)
process.exit(error === 0 ? 0 : 1)
