import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

/**
 * Compiles the module through gradle, then dexes the target class and every
 * synthetic sibling Kotlin emitted for it.
 *
 * The siblings matter: a lambda or a coroutine body becomes its own class, and
 * redefining the outer one alone leaves the runtime pointing at stale code.
 */
export function buildDex({ className, project, gradleTask, classesDir }) {
  execFileSync('./gradlew', [gradleTask, '-q'], { cwd: project, stdio: 'inherit' })

  const parts = className.split('/')
  const simple = parts.pop()
  const packageDir = join(classesDir, ...parts)

  if (!existsSync(packageDir)) throw new Error(`no compiled classes in ${packageDir}`)

  const targets = readdirSync(packageDir)
    .filter((f) => f === `${simple}.class` || f.startsWith(`${simple}$`))
    .map((f) => join(packageDir, f))

  if (targets.length === 0) throw new Error(`${simple}.class not found in ${packageDir}`)

  const out = mkdtempSync(join(tmpdir(), 'hotswap-'))
  execFileSync(dexer(), ['--min-api', '28', '--output', out, ...targets], { stdio: 'inherit' })

  return { dex: readFileSync(join(out, 'classes.dex')), classCount: targets.length }
}

function dexer() {
  const sdk = process.env.ANDROID_HOME ?? join(process.env.HOME, 'Library/Android/sdk')
  const tools = join(sdk, 'build-tools')
  const newest = readdirSync(tools).sort().pop()

  return join(tools, newest, 'd8')
}
