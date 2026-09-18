#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { relative, resolve } from 'node:path'
import { buildDex } from '../src/library/build-dex.js'
import { loadConfig } from '../src/library/load-config.js'
import { resolveClassName } from '../src/library/resolve-class-name.js'
import { sendRedefinition } from '../src/library/send-redefinition.js'
import { watchKotlin } from '../src/library/watch-kotlin.js'

const root = process.cwd()
const config = loadConfig(root)
const [, , file] = process.argv

execFileSync('adb', ['forward', `tcp:${config.port}`, `tcp:${config.port}`], { stdio: 'ignore' })

if (file) {
  await swap(resolve(file))
  process.exit(0)
}

console.log(`hotswap  watching ${relative(root, config.watch)}  →  127.0.0.1:${config.port}`)
watchKotlin(config.watch, swap)

async function swap(path) {
  const started = Date.now()
  const name = relative(root, path)

  try {
    const className = resolveClassName(path)
    const { dex, classCount } = buildDex({ className, ...config })
    const error = await sendRedefinition({ className, dex }, config.port)
    const took = Date.now() - started

    const classes = classCount > 1 ? ` +${classCount - 1}` : ''
    console.log(
      error === 0
        ? `  ✅ ${name}${classes}  ${took}ms`
        : `  ❌ ${name}  jvmtiError ${error}  ${took}ms`,
    )
  } catch (cause) {
    console.log(`  ❌ ${name}  ${cause.message.split('\n')[0]}`)
  }
}
