# Tooling

The package manager is **bun**.

## Commands

| Command                           | What it does                             |
| --------------------------------- | ---------------------------------------- |
| `bun run build`                   | `tsc` into `lib/`, which is what ships   |
| `bun run typecheck`               | `tsc --noEmit`                           |
| `bun run test` / `test:watch`     | Vitest                                   |
| `bun run lint` / `lint:fix`       | ESLint                                   |
| `bun run format` / `format:check` | Prettier                                 |
| `bun run clean`                   | `git clean -dfX`                         |
| `hotswap --check`                 | reports what is wired up and what is not |
| `npm pack --dry-run`              | what a consumer would actually receive   |
| `bun run release`                 | semantic-release; CI runs it, not you    |

From `example/android`, which is where a real build of the agent happens:

| Command                                         | What it does                                              |
| ----------------------------------------------- | --------------------------------------------------------- |
| `./gradlew :react-native-hotswap:assembleDebug` | builds the agent alone, the fast check after touching C++ |
| `./gradlew :app:installDebug`                   | builds and installs the example                           |

## How a consumer turns it on

Patching needs the watcher and nothing else:

```js
// metro.config.js
const { withHotswap } = require('react-native-hotswap/metro.cjs');
module.exports = withHotswap(mergeConfig(getDefaultConfig(__dirname), config), {
  roots: [__dirname, join(__dirname, 'probe')],
});
```

Generations need one line per platform on top of that — `HotswapReactHost.create` on Android,
`getModuleClassFromName:` on iOS. The README carries both, and `rules/architecture.md` says
why each is the hook it is. Without them, patching still works and generations do not.

Swift also needs the Podfile hook, which adds `-interposable` and `-enable-implicit-dynamic`
to debug builds. Without them a method is not replaceable at all.

## Android

| Item                    | Value  | Why                                         |
| ----------------------- | ------ | ------------------------------------------- |
| `minSdkVersion`         | 23     | the package installs anywhere               |
| Agent requires          | API 28 | `Debug.attachJvmtiAgent`                    |
| Structural redefinition | API 30 | below it, only method bodies swap           |
| `compileSdkVersion`     | 36     | what the example builds against             |
| Java / `jvmTarget`      | 17     | the React Native plugin compiles Java at 17 |

The agent is built by CMake into `libhotswap.so` for all four ABIs and shipped inside the AAR.

### The vendored header

`jvmti.h` comes from AOSP because the NDK does not ship it. It is **GPLv2 with the Classpath
Exception**, which exists precisely so that linking against it imposes nothing on this
package's MIT licence. Keep the header untouched and keep it credited.

## The dev loop

```
save .kt
  → gradle compiles the module        ← the slow part, ~1s
  → d8 dexes the class and siblings
  → socket to 127.0.0.1:8099
  → ART redefines
```

Around 1.2s end to end. Most of it is Gradle; calling `kotlinc` directly would cut it, and is
the obvious optimisation once correctness settles.

The other three loops, for reference, all measured on `example/`:

| Path           | Time    | The slow part                  |
| -------------- | ------- | ------------------------------ |
| C++ on Android | ~0.4s   | compiling one translation unit |
| C++ on iOS     | ~0.8s   | linking and loading            |
| Swift on iOS   | ~1.2s   | linking and loading            |
| A generation   | ~0.5–2s | gradle, or a replayed `swiftc` |

Both iOS paths used to run a full `xcodebuild` per save: ~3s for Swift and ~15s for C++.
Almost all of it was React Native's module maps being reparsed. Each now replays the
invocation Xcode itself used, against a module cache that survives between saves, so the
compile is 0.15s for Swift and 0.28s for C++. One `xcodebuild` at start captures both.

xcodebuild is still the answer when a capture no longer fits, and the capture is thrown away
when a replay fails, so the next save takes a fresh one.

The watcher warms both compilers when it starts, so the first save of a session costs what the
others do rather than 16s.

An iOS generation being faster than an iOS patch is not a mistake: patching pays for Xcode on
every save, and a generation replays the captured invocation directly.

`adb forward tcp:8099 tcp:8099` is set by the CLI on start, so it survives a device reconnect
only if the watcher restarts.

## Debugging a failed swap

```bash
adb logcat -s Hotswap
```

| Symptom                                   | Cause                                                                    |
| ----------------------------------------- | ------------------------------------------------------------------------ |
| `agent missing at …`                      | `useLegacyPackaging` is off                                              |
| `could not add redefinition capabilities` | asked for more than ART grants                                           |
| `jvmtiError 21`                           | `INVALID_CLASS` — the class name is wrong, usually a missing `Kt` suffix |
| `jvmtiError 103`                          | `ILLEGAL_ARGUMENT` — known open issue on Nitro implementation classes    |
| nothing at all                            | the agent never attached; check for the `attached` line at app start     |

For a generation:

| Symptom                                            | Cause                                                        |
| -------------------------------------------------- | ------------------------------------------------------------ |
| `the app is not on a hotswap React host`           | `MainApplication` still calls `getDefaultReactHost`          |
| `no React package here to rebuild the module from` | the module, or the app, declares no `ReactPackage`           |
| `UnsatisfiedLinkError` on a `<clinit>`             | a class with native methods ended up owned by the generation |
| the reload happens and nothing changes             | the delegate hook is missing, or the module is a legacy one  |

## The pipeline

Four workflows, all under `.github/workflows/`:

| Workflow            | When                     | What it proves                            |
| ------------------- | ------------------------ | ----------------------------------------- |
| `verify.yml`        | every push and PR        | types, lint, format, tests, and the agent |
| `android-build.yml` | paths touching Android   | the example app still assembles           |
| `ios-build.yml`     | paths touching iOS       | the podspec and the example still build   |
| `release.yml`       | `workflow_dispatch` only | a version, a tag, a changelog, npm        |

Releases are **manual by design**: `workflow_dispatch`, never on push. A tool that rewrites a
running app should not publish itself the moment someone merges.

`release.config.cjs` maps each commit type to a bump and a changelog section. `test`, `ci` and
`style` carry `release: false`, so they appear in the notes of a release something else
triggered and never trigger one alone.

There is no `NPM_TOKEN`. Publishing goes through npm's trusted publishing, so the job asks
GitHub for an OIDC token and npm exchanges it. That needs three things:

- **`id-token: write`** on the job, which it has.
- **A trusted publisher on npmjs.com** for this package, pointing at this repository and
  `release.yml`.
- **A recent npm on the runner.** `@semantic-release/npm` uses the OIDC context only to skip
  its own token check; the exchange happens inside `npm publish`, and the runner image ships an
  npm too old for it. The job upgrades npm first.

What is still missing is a **remote**. There is none yet, so nothing here has ever run. `bunx
semantic-release --dry-run --no-ci` fails at `git ls-remote`, and that is the only reason.

The example installs with **npm**, not bun: it links the library with `file:..` and keeps its
own `package-lock.json`. CI installs the library with bun first, because npm has to find
`lib/` already built by the library's `prepare`.

## Prettier and ESLint

Prettier is the single source of formatting. ESLint carries `max-params: 2` and
`import-x/order` — type imports first, then builtins, then the rest, alphabetised — and
nothing about style.
