# Tests

Vitest, unit tests only.

| Command              | What                 |
| -------------------- | -------------------- |
| `bun run test`       | everything           |
| `bun run test:watch` | everything, in watch |

## Only what is pure gets tested

Most of this package talks to something: gradle, d8, a socket, the filesystem, ART. None of
that is unit tested, and mocking it would only prove the mock works.

| Layer                          | How it is verified                            |
| ------------------------------ | --------------------------------------------- |
| `library/` pure functions      | Vitest                                        |
| `buildDex`, `sendRedefinition` | running the tool against the example app      |
| `agent.cpp`                    | the same, reading logcat                      |
| `ios/`, the Swift path         | the simulator, reading the unified log        |
| `metro.cjs`                    | starting Metro and watching for the swap line |

**Every pure function exported from `library/` has a test.** When a function is hard to test,
split the decision from the effect rather than reaching for a mock — that is how
`resolveClassName` ended up taking source text instead of a path.

## `__tests__/` next to the code

```
cli/src/library/
├── resolve-class-name.js
└── __tests__/resolve-class-name.test.js
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

There is no automated end-to-end test, and adding one would mean booting an emulator in CI.
The check is:

```bash
# in react-native-unfold, with the example running on the foldable AVD
# edit android/src/main/java/com/unfold/library/ToPosture.kt
#   HALF_OPENED -> FoldPosture.CLOSED
```

The app must report `posture: closed`, which the Android implementation can never produce on
its own, in the same pid. That single observation covers the agent, the protocol, the dexing
and the class lookup at once.

For Swift, add an `NSLog` to a method and watch for it after a save:

```bash
xcrun simctl spawn <device> log show --last 30s --predicate 'eventMessage CONTAINS "Hotswap"'
```

The line to look for is `swift replacements applied`. `no swift replacements` means the dylib
loaded and changed nothing, which the CLI reports as a failure.
