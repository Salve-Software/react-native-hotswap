# react-native-hotswap

Change your Kotlin, Swift or C++, save, and the running app picks it up. No reinstall, no
restart, no lost state.

```
hotswap  watching android/src/main/java  →  127.0.0.1:8099
  ✅ probe/android/src/main/java/com/probe/ProbeValues.kt  1234ms
  ✅ probe/cpp/probe.cpp  435ms
```

|                       | Save to running                           |
| --------------------- | ----------------------------------------- |
| Rebuild and reinstall | 10–30s, and the app restarts from scratch |
| **hotswap, Kotlin**   | **~1s, same process**                     |
| **hotswap, C++**      | **~0.5s Android, ~3s iOS**                |
| **hotswap, Swift**    | **~6s, same process**                     |

## Install

```bash
npm install --save-dev react-native-hotswap
```

Two lines in `metro.config.js`, and Android is done:

```js
const { withHotswap } = require('react-native-hotswap/metro.cjs');

// `roots` is optional. Pass one per place you keep native code.
module.exports = withHotswap(mergeConfig(getDefaultConfig(__dirname), config));
```

The watcher starts with Metro and the agent attaches when the app launches. Everything else is
read out of your Gradle build. There is nothing to add to `build.gradle` and nothing to call
from your code.

On Expo, add `"react-native-hotswap"` to `plugins` in `app.json` instead of editing native
files by hand, and use a development build. [docs/expo.md](docs/expo.md) covers it.

Swift needs two more lines in the `Podfile`. Without them a Swift method cannot be replaced at
all:

```ruby
require Pod::Executable.execute_command('node', ['-p',
  'require.resolve("react-native-hotswap/hotswap.rb", {paths: [process.argv[1]]})',
  __dir__]).strip

# inside post_install
hotswap_post_install(installer)
```

## New files and removed methods

Patching rewrites code that is already loaded, so it cannot add a class or remove a method.
When the runtime refuses for that reason, hotswap publishes a generation instead: it rebuilds
the module, loads it beside what is running, and React Native builds its next instance from it.

```
  ♻️  probe/android/.../BornAtRuntime.kt  reloaded from a new generation  942ms
```

The cost is your JS state. React rebuilds its instance, so the app goes back to its first
screen. The process keeps running, and patching is still tried first.

Generations need one line per platform:

```kotlin
// MainApplication.kt
override val reactHost: ReactHost by lazy {
  HotswapReactHost.create(applicationContext) { PackageList(this).packages }
}
```

```swift
// your RCTDefaultReactNativeFactoryDelegate subclass
import RNHotswap

@objc(getModuleClassFromName:)
func hotswapModuleClass(_ name: UnsafePointer<CChar>) -> AnyClass? {
  Hotswap.moduleClass(fromName: name)
}
```

Leave them out and patching still works. Only generations stop.

## What you see

A successful swap draws a violet pill over the running app. It is not React Native's blue bar
on purpose, so you can tell which half of the app changed when both show up. A failed swap
draws nothing, and the terminal says why.

When a save seems to do nothing, run `npx hotswap --check`. It lists what is wired up and what
is not. Usually the app is not running, or the build was not debuggable.

## Limits

| Change                                 | Result                                    |
| -------------------------------------- | ----------------------------------------- |
| Method body, anywhere                  | ✅ patched                                |
| New method or field on a class         | ✅ patched, Android 11+                   |
| A class in a new file                  | ✅ a generation                           |
| Removing a method or field             | ✅ a generation                           |
| `MainActivity`, `MainApplication`      | patched only. A reload keeps the Activity |
| Objective-C, inlined code, iOS devices | ⛔ never                                  |
| Release builds                         | ⛔ by design                              |

| Requires |                                                                                       |
| -------- | ------------------------------------------------------------------------------------- |
| Android  | API 28 to attach, API 30 for structural changes                                       |
| iOS      | simulator only                                                                        |
| Build    | debuggable, build tools 34–36 ([not 37](docs/how-it-works.md#why-not-build-tools-37)) |

## Docs

`example/` is a React Native app with its own native code and a module beside it, both wired
up. Run `cd example && npm install && npx react-native start`, then edit one of the files it
lists on screen.

| Doc                                  | What is in it                                      |
| ------------------------------------ | -------------------------------------------------- |
| [Expo](docs/expo.md)                 | the config plugin, and why a dev build is required |
| [How it works](docs/how-it-works.md) | JVMTI, dynamic replacement, vtables, and prior art |
| [Generations](docs/generations.md)   | the second mechanism, in full                      |
| [Limits](docs/limits.md)             | everything that does and does not swap             |

## Licence

MIT.

`android/src/main/cpp/vendor/jvmti.h` comes from AOSP and is GPLv2 with the Classpath
Exception, so linking against it imposes nothing on this package. The header is kept as
published, with its licence notice intact.
