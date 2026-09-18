# Tests

Vitest, unit tests only.

| Command              | What                 |
| -------------------- | -------------------- |
| `bun run test`       | everything           |
| `bun run test:watch` | everything, in watch |

## Only what is pure gets tested

Most of this package talks to something: gradle, d8, a socket, the filesystem, ART. None of
that is unit tested, and mocking it would only prove the mock works.

| Layer                             | How it is verified                                                    |
| --------------------------------- | --------------------------------------------------------------------- |
| `library/` pure functions         | Vitest                                                                |
| Everything that compiles or sends | running the tool against `example/`                                   |
| `agent.cpp`, `native_swap.cpp`    | the same, reading `adb logcat -s Hotswap`                             |
| `ios/`                            | the simulator's unified log, and a screenshot for anything JS renders |
| Generations                       | the probe reporting a value the installed app cannot produce          |
| `metro.cjs`                       | starting Metro and watching for the `watching` line per root          |

**Every pure function exported from `library/` has a test.** When a function is hard to test,
split the decision from the effect rather than reaching for a mock — that is how
`resolveClassName` ended up taking source text instead of a path.

## `__tests__/` next to the code

```
src/classes/swapper/kotlin-swapper/library/
├── resolve-class-name.ts
└── __tests__/resolve-class-name.test.ts
```

## Rules

- **No module mocking.** Ever.
- **A test name describes behaviour, not a method.** `'a file of top-level functions compiles
to a Kt suffix'`, never `'resolveClassName returns FooKt'`.
- **Tests do no I/O and use no network.**
- **A parser is tested with the real thing.** Kotlin source in the fixtures, not a string
  shaped to satisfy the regex.

## What must always be covered

- **The `Kt` suffix** — a file of top-level functions compiles to `FooKt`, a file declaring
  `class Foo` compiles to `Foo`. Getting this wrong makes every swap fail with
  `INVALID_CLASS`, and the error points nowhere near the cause.
- **`object` and `interface`** — they take the bare name too, and only `class` is obvious.
- **A missing package declaration** — throws rather than producing a broken class name.
- **Config path resolution** — an override reads as relative to the module, not to `cwd`.

## The manual check

The fixture is `example/`, in this repository. `example/probe` is a module; the app has its
own `AppPackage` so both shapes are covered. Nothing here depends on another checkout.

Start Metro from `example/` and launch both apps. The probe reports once a second:

```bash
adb logcat -s Probe AppProbe
xcrun simctl spawn booted log stream --predicate 'eventMessage CONTAINS "[Probe]"'
```

```
Probe: kotlin=1 cpp=10 shape=1        AppProbe: app=1
```

### Patching

Change a value and watch the number follow, with the pid unchanged:

| Edit                               | Expect                                                   |
| ---------------------------------- | -------------------------------------------------------- |
| `probe/android/.../ProbeValues.kt` | `✅`, `kotlin=` moves                                    |
| `probe/cpp/probe.cpp`              | `✅`, `shape=` moves, both platforms if both are running |
| `probe/cpp/probe.hpp`              | `↳ included by 2`, then both units                       |
| `probe/ios/ProbeValues.swift`      | `✅`, and `swift replacements applied` in the log        |
| `android/app/.../AppValues.kt`     | `✅`, `app=` moves — the app's own code                  |

A number that moves while the line says `❌`, or the reverse, is the failure worth chasing:
the tool's job is to report what happened, and it has been wrong in both directions before.

### Generations

Create a file and call it from an existing one. Expect the patch to be refused and a
generation to follow:

```
  ↻ BornAtRuntime.kt  class not loaded yet
  ♻️  BornAtRuntime.kt  reloaded from a new generation  942ms
```

The reporter from the generation logs on a **new thread id** while the old one keeps going on
the old value. Both is correct: a generation ends the code, not the thread a module started.

For iOS the same is reached by adding a method — there is nothing for a replacement to attach
to, so the app refuses and the generation follows. The end-to-end reading is on screen:

```
Probe module comes from: generation (246810)
```

That one covers the most ground of any check here: JS calls a codegen'd TurboModule, React
Native resolves it through the delegate, and the value comes from a method that did not exist
when the app was installed.

### Two things the probe itself has to get right

Both cost a cycle to learn:

- **The driver cannot live in the file being swapped**, or loading the patch runs it a second
  time and the reading is worthless.
- **Nothing references a probe, so the linker drops it.** It survives in a static library only
  if an Objective-C `+load` pulls the object in, since the app links with `-ObjC`. Android has
  no such problem: a shared library keeps every object it was given.

### And two that will waste an hour

- **`pod install` after creating any file**, or Xcode never sees it.
- **Restart Metro after rebuilding the CLI.** The watcher holds the `lib/` it imported at
  start, so a rebuild changes nothing until it does.
