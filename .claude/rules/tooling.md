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
| C++ on iOS     | ~4s     | Xcode                          |
| Swift on iOS   | ~6s     | Xcode                          |
| A generation   | ~0.5–2s | gradle, or a replayed `swiftc` |

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

## Prettier and ESLint

Prettier is the single source of formatting. ESLint carries `max-params: 2` and
`import-x/order` — type imports first, then builtins, then the rest, alphabetised — and
nothing about style.
