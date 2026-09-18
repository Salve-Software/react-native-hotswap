import { basename } from 'node:path'
import { readFileSync } from 'node:fs'

/** Derives the JNI class name a Kotlin file compiles into. */
export function resolveClassName(file) {
  const source = readFileSync(file, 'utf8')
  const name = basename(file, '.kt')

  const pkg = /^\s*package\s+([\w.]+)/m.exec(source)?.[1]
  if (!pkg) throw new Error(`no package declaration in ${file}`)

  const declares = new RegExp(`^\\s*(?:\\w+\\s+)*(?:class|object|interface)\\s+${name}\\b`, 'm')
  const simple = declares.test(source) ? name : `${name}Kt`

  return `${pkg.replace(/\./g, '/')}/${simple}`
}
