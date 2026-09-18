# Tooling

The package manager is **bun**.

## Commands

| Command                            | What it does                             |
| ---------------------------------- | ---------------------------------------- |
| `bun run build`                    | `tsc` into `lib/`, which is what ships   |
| `bun run typecheck`                | `tsc --noEmit`                           |
| `bun run test` / `test:watch`      | Vitest                                   |
| `bun run lint` / `lint:fix`        | ESLint                                   |
| `bun run format` / `format:check`  | Prettier                                 |
| `bun run clean`                    | `git clean -dfX`                         |
| `hotswap --check`                  | reports what is wired up and what is not |
| `./gradlew :android:assembleDebug` | builds the AAR with the agent inside     |

## How a consumer turns it on

Two steps, and the second is the one people forget:

```js
// metro.config.js
const { withHotswap } = require('react-native-hotswap/metro.cjs');
module.exports = withHotswap(mergeConfig(getDefaultConfig(__dirname), config));
```

```gradle
// android/app/build.gradle
packagingOptions { jniLibs { useLegacyPackaging = true } }
```

Without `useLegacyPackaging` the agent stays compressed inside the APK, there is no file path
to attach, and the log says `agent missing`.

## Android

| Item                    | Value  | Why                                         |
| ----------------------- | ------ | ------------------------------------------- |
| `minSdkVersion`         | 23     | the package installs anywhere               |
| Agent requires          | API 28 | `Debug.attachJvmtiAgent`                    |
| Structural redefinition | API 30 | below it, only method bodies swap           |
| `compileSdkVersion`     | 35     | current                                     |
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

Around 1.3s end to end. Most of it is Gradle; calling `kotlinc` directly would cut it, and is
the obvious optimisation once correctness settles.

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

## Prettier and ESLint

Prettier is the single source of formatting. ESLint carries `max-params: 2` and
`import-x/order` — type imports first, then builtins, then the rest, alphabetised — and
nothing about style.
