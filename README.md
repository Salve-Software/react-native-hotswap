# react-native-hotswap

Change your Kotlin, Swift or C++, save, and the running app picks it up. No reinstall, no
restart, no lost state.

```
hotswap  watching android/src/main/java  →  127.0.0.1:8099
  ✅ android/src/main/java/com/unfold/library/ToPosture.kt  952ms
  ✅ android/src/main/java/com/unfold/HybridUnfoldBridge.kt +3  1198ms
  ✅ cpp/FoldGeometry.cpp  3105ms
```

|                       | Save to running                           |
| --------------------- | ----------------------------------------- |
| Rebuild and reinstall | 10–30s, and the app restarts from scratch |
| **hotswap, Kotlin**   | **~1s, same process**                     |
| **hotswap, Swift**    | **~6s, same process**                     |
| **hotswap, C++**      | **~3s, same process**                     |

## Install

```bash
npm install --save-dev react-native-hotswap
```

Then two lines in `metro.config.js`:

```js
const { withHotswap } = require('react-native-hotswap/metro.cjs');

module.exports = withHotswap(mergeConfig(getDefaultConfig(__dirname), config));
```

That is the whole setup for Android. The watcher starts with Metro, the agent attaches when
the app launches, and everything else is derived from your Gradle build. There is nothing to
add to `build.gradle`, and nothing to call from your code.

For Swift, two more lines in the `Podfile`:

```ruby
require Pod::Executable.execute_command('node', ['-p',
  'require.resolve("react-native-hotswap/hotswap.rb", {paths: [process.argv[1]]})',
  __dir__]).strip

# inside post_install
hotswap_post_install(installer)
```

That adds `-interposable` and `-enable-implicit-dynamic` to debug builds, which is what makes
a Swift method replaceable at all.

## It is not only for libraries

The agent redefines Kotlin classes; it has no idea what a Nitro module is. Point it at an
app and it swaps the app's own code:

```
  ✅ android/app/src/main/java/com/unfoldexample/MainActivity.kt  1578ms
```

Run it from a project with `android/app/` and it configures itself for that. What a Nitro
module buys is the safety check: the spec is the ABI, so hotswap knows when a swap would be
unsound. An app has no such file, so that guarantee is on you.

## When it does not work

```bash
npx hotswap --check
```

```
hotswap  setup
  ✅ gradle project     example/android
  ✅ kotlin sources     android/src/main/java
  ✅ nitro spec         guard is active
  ✅ android device     adb devices
  ✅ agent reachable    port 8099
  ✅ ios workspace      example/ios/UnfoldExample.xcworkspace
```

`agent reachable` failing usually means the app is not running, or the build was not
debuggable.

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
| **Removing** a method or field      | ⛔ ART never allows it     |
| Changing a Nitro spec               | ⛔ refused, with a message |

Removing is the asymmetry worth knowing: you can add a method, but once the running class has
it, taking it away needs a rebuild. Add a helper, delete it, and swaps stop working until you
restart the app — hotswap says so rather than printing a number:

```
  ❌ ToPosture.kt  a method was removed, which ART never allows; rebuild
```

The spec row is deliberate. A spec change means nitrogen has to regenerate the C++ bridge, so
the ABI moved and swapping Kotlin against it would produce an app that half-works. hotswap
refuses and tells you:

```
  ⛔ ToPosture.kt  src/specs/unfold.nitro.ts changed; run codegen and rebuild
```

## What it cannot change

- **C++ on Android.** Android blocks loading code from app-writable storage, so a recompiled
  `.so` would need root and an ELF rebinder. C++ swaps on the iOS simulator, where nothing
  stops a dylib from loading — see below.
- **Objective-C and Objective-C++.** Compiling a `.mm` into the patch would define its classes
  a second time, and the runtime resolves that by picking one of them. `.m` and `.mm` are left
  alone on purpose.
- **Anything already inlined.** A body the compiler copied into its callers is not reachable
  by any of this. Debug builds inline little, which is why it mostly does not come up.
- **A function pointer that lives on the heap.** Vtables are patched because they sit in the
  image's data sections, which is what gets scanned. A `std::function` built at runtime, or a
  callback table allocated on the heap, still holds the old address and keeps calling it.
- **Swift properties and new methods.** iOS replaces method bodies, through Swift's dynamic
  replacement. A method that did not exist when the app launched has nothing to replace.
- **iOS devices.** Simulator only.
- **A class the app has not loaded yet.** It is skipped, and picked up from disk when it does
  load.
- **Release builds.** The agent only attaches when the app is debuggable, and ART refuses
  otherwise regardless.

## Requirements

|             |                                                  |
| ----------- | ------------------------------------------------ |
| Android     | API 28 to attach, API 30 for structural changes  |
| iOS         | simulator, and the Podfile hook below            |
| Languages   | Kotlin on Android; Swift and C++ on iOS          |
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

### iOS, and why it is shaped this way

A changed Swift file is rewritten as an extension of `@_dynamicReplacement` methods, written
into `ios/HotswapPatch.swift`, compiled by Xcode, and linked alone into a dylib. Three
attempts got there:

| Attempt                                          | Outcome                                                           |
| ------------------------------------------------ | ----------------------------------------------------------------- |
| Reproduce swiftc's invocation                    | each missing header search path revealed another                  |
| Link the module's objects                        | loads a second copy of the module's Swift metadata, kills the app |
| **Generate, let Xcode compile, link one object** | works                                                             |

Symbol rebinding is not the mechanism for Swift. Nitro dispatches through a C++ vtable, so
nothing names the Swift method in a way that could be rewritten; dynamic replacement goes
around it.

Two things to know:

- `ios/HotswapPatch.swift` has to exist before `pod install`, because CocoaPods globs sources
  at install time. It is rewritten on every save.
- Each swap links a dylib under a new name. dyld keys a loaded image on its install name, so
  reusing one would hand back the first handle and quietly leave the old code running.

### C++, and the two ways a call finds its target

C++ needs no rewriting: the changed file is included into a patch the pod already globs, so
Xcode compiles it with the target's own flags and its relative includes keep resolving. The
work is on the other side, because a call reaches its target in one of two ways and only one
of them names a symbol.

| Call                              | How it is reached       | What swaps it                    |
| --------------------------------- | ----------------------- | -------------------------------- |
| Free function, non-virtual method | a symbol slot, via GOT  | rebinding, needs `-interposable` |
| **Virtual method**                | a pointer in the vtable | overwriting that pointer         |

The vtable holds the address directly and names nothing, which is why a virtual method kept
running its old body while a free function in the same file swapped correctly. Every address
the new image defines is now found in the running images by name and overwritten in their data
sections, which is where a vtable lives. Only symbols in executable sections count — a global
in the edited file would otherwise have its pointers aimed at a fresh copy and lose its state.

One consequence is not obvious: a patched vtable slot no longer holds the address the app's
symbol table reports, so hotswap remembers what each swap installed. Without that, the second
swap of a method looks up an address that is no longer in the slot and the first swap's code
keeps running.

Measured on the example, in one process, no restart:

```
baseline  free=7  virtual=4242
swap 1    free=11 virtual=22     16645ms   (first build after a reinstall)
swap 2    free=33 virtual=44      3105ms
```

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
