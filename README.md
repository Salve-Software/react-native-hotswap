# react-native-hotswap

Change your Kotlin, save, and the running app picks it up. No reinstall, no restart, no lost
state.

```
hotswap  watching android/src/main/java  →  127.0.0.1:8099
  ✅ android/src/main/java/com/unfold/library/ToPosture.kt  952ms
  ✅ android/src/main/java/com/unfold/HybridUnfoldBridge.kt +3  1198ms
```

|                       | Save to running                           |
| --------------------- | ----------------------------------------- |
| Rebuild and reinstall | 10–30s, and the app restarts from scratch |
| **hotswap**           | **~1s, same process**                     |

## Install

```bash
npm install --save-dev react-native-hotswap
```

Then two lines in `metro.config.js`:

```js
const { withHotswap } = require('react-native-hotswap/metro.cjs');

module.exports = withHotswap(mergeConfig(getDefaultConfig(__dirname), config));
```

That is the whole setup. The watcher starts with Metro, the agent attaches when the app
launches, and everything else is derived from your Gradle build.

There is nothing to add to `build.gradle`, and nothing to call from your code.

## What it can change

More than you would expect. ART's structural redefinition — Android 11 and up — is not
limited to method bodies:

| Change                              | Works                      |
| ----------------------------------- | -------------------------- |
| Method body                         | ✅                         |
| **New method on an existing class** | ✅                         |
| **New field on an existing class**  | ✅                         |
| New top-level function              | ✅                         |
| New class                           | ✅ loads normally          |
| Changing a Nitro spec               | ⛔ refused, with a message |

The last row is deliberate. A spec change means nitrogen has to regenerate the C++ bridge, so
the ABI moved and swapping Kotlin against it would produce an app that half-works. hotswap
refuses and tells you:

```
  ⛔ ToPosture.kt  src/specs/unfold.nitro.ts changed; run codegen and rebuild
```

## What it cannot change

- **C++.** Android blocks loading code from app-writable storage, so the C++ half of a Nitro
  module still needs a rebuild.
- **iOS.** Not implemented yet. The mechanism is different — a recompiled dylib plus linker
  interposing — and it is the next thing on the list.
- **A class the app has not loaded yet.** It is skipped, and picked up from disk when it does
  load.
- **Release builds.** The agent only attaches when the app is debuggable, and ART refuses
  otherwise regardless.

## Requirements

|             |                                                  |
| ----------- | ------------------------------------------------ |
| Android     | API 28 to attach, API 30 for structural changes  |
| Build       | debuggable                                       |
| Build tools | 34, 35 or 36 — [not 37](#why-not-build-tools-37) |

## How it works

```
your machine                          device
────────────                          ──────
metro.config.js  starts the watcher
  ↓ you save a .kt
gradle compiles the module
d8 dexes the class and its lambdas
  ↓ socket, port 8099
                                      agent.cpp
                                      ART redefines the classes, atomically
```

A JVMTI agent ships inside the package's AAR and attaches itself at app start through
`Debug.attachJvmtiAgent`. The CLI compiles through your own Gradle build, so the bytecode
matches what is already installed.

### Things Android does not document

Four of these cost a full evening. They are written down so the next person does not pay
again:

|                                                             |                                                                                               |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `Debug.attachJvmtiAgent` rejects any path containing `=`    | every install directory is base64 and ends in `==`, so the agent is reached through a symlink |
| W^X blocks `dlopen` from app storage                        | the symlink resolves into the apk, which keeps the label that permits execution               |
| `FindClass` on the agent thread sees only the system loader | app classes are found by walking `GetLoadedClasses`                                           |
| ART accepts exactly one class def per dex                   | each class travels in its own dex, sent as one atomic batch                                   |

### Why not build tools 37

d8 from build-tools 37 drops `ACC_PRIVATE` from the synthetic methods Kotlin generates for
lambdas. ART compares the incoming class against the installed one and refuses the mismatch
with `jvmtiError 71`. Versions 34 through 36 preserve the flag.

hotswap reads `buildToolsVersion` from your build and, failing that, picks the newest version
at or below 36.

## Prior art

Hot reload for JVM code is not new, but nothing covered React Native's native modules.

|                                                                       | What it does                                          |
| --------------------------------------------------------------------- | ----------------------------------------------------- |
| [HotswapAgent](https://github.com/HotswapProjects/HotswapAgent)       | JVM desktop, through JPDA                             |
| [Compose Hot Reload](https://github.com/JetBrains/compose-hot-reload) | Compose on the JetBrains Runtime, desktop             |
| [Compose HotSwan](https://hotswan.dev)                                | Compose on Android; moved off JVMTI to an interpreter |
| [InjectionIII](https://github.com/johnno1962/InjectionIII)            | Swift and Objective-C, through dylib interposing      |

HotSwan's move away from JVMTI is worth reading, and worth qualifying: the ceiling they
describe is classic `RedefineClasses`. ART's structural extension clears it for the cases
above.

## Licence

MIT.

`android/src/main/cpp/vendor/jvmti.h` comes from AOSP and is GPLv2 with the Classpath
Exception, which exists so that linking against it imposes nothing on this package. The
header is kept as published, licence notice intact.
