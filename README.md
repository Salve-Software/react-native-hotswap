# react-native-hotswap

Change your Kotlin, Swift or C++, save, and the running app picks it up. No reinstall, no
restart, no lost state.

```
hotswap  watching android/src/main/java  →  127.0.0.1:8099
  ✅ probe/android/src/main/java/com/probe/ProbeValues.kt  1234ms
  ✅ probe/cpp/probe.cpp  435ms
  ✅ cpp/FoldGeometry.cpp  3105ms
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
  ✅ android/app/src/main/java/com/hotswapexample/AppValues.kt  1548ms
```

Run it from a project with `android/app/` and it configures itself for that. What a Nitro
module buys is the safety check: the spec is the ABI, so hotswap knows when a swap would be
unsound. An app has no such file, so that guarantee is on you.

Kotlin is the part that does not care. Swift and C++ are compiled through the pod the module
ships, so an app with no podspec of its own swaps Kotlin only — `--check` says so rather than
letting the first save fail on a missing build setting.

## A file that did not exist a moment ago

Patching cannot add a class, remove a method or change a hierarchy — the shape of what is
already loaded is fixed. When ART or the Swift compiler refuses on those grounds, hotswap
stops patching and **publishes a generation** instead: the module is rebuilt, loaded beside
what is running, and React Native is asked to build its next instance from it.

```
  ↻ probe/android/.../BornAtRuntime.kt  class not loaded yet
  ♻️  probe/android/.../BornAtRuntime.kt  reloaded from a new generation  942ms
```

Nothing is stitched into anything, so a new file is no harder than a changed line.

**What it costs.** A generation recreates the React instance, so JS state goes back to where
the app starts. The process is never restarted and it takes about a second, but it is not
Fast Refresh — patching is, and it stays the first thing tried.

### Turning it on

Android, in `MainApplication.kt`:

```kotlin
override val reactHost: ReactHost by lazy {
  HotswapReactHost.create(applicationContext) { PackageList(this).packages }
}
```

iOS, in your `RCTDefaultReactNativeFactoryDelegate` subclass:

```swift
import RNHotswap

@objc(getModuleClassFromName:)
func hotswapModuleClass(_ name: UnsafePointer<CChar>) -> AnyClass? {
  Hotswap.moduleClass(fromName: name)
}
```

Returning nil is what React Native already reads as "not mine", so the line is inert until a
generation exists. The selector is spelled out because Swift cannot see the method: the
delegate protocol only conforms to `RCTTurboModuleManagerDelegate` under `__cplusplus`.

Without these, patching still works and generations do not.

### Your own native code counts

Nothing here is about modules in particular. A generation replaces whatever the packages
provide, so an app's own Kotlin swaps the same way — including a class created while it was
running — as long as the app exposes a `ReactPackage`, which is how it exposes native code to
React Native anyway.

What generations cannot reach is `MainActivity` and `MainApplication`: a React reload rebuilds
the React instance, not the Activity. Those are patched, which works and keeps the app where
it was.

An app usually has both its own code and modules, so the watcher takes more than one root:

```js
module.exports = withHotswap(mergeConfig(getDefaultConfig(__dirname), config), {
  roots: [__dirname, join(__dirname, 'probe')],
});
```

```
hotswap  watching example: android/app/src/main/java
hotswap  watching probe: android/src/main/java, android/src/main/cpp, ios, cpp
```

## Headers

Editing a `.h` or `.hpp` swaps everything that reaches it, since a header compiles into
nothing of its own:

```
  ↳ cpp/FoldGeometry.hpp  included by 2
  ✅ cpp/FoldGeometry.cpp  278ms
  ✅ cpp/FoldMath.cpp  291ms
```

The graph is built from quoted includes across the watched directories, followed through
other headers. An angled include belongs to a framework and stops the walk. A translation
unit outside the watched directories is not reached, which is the case worth knowing.

## On screen

A swap you have to go looking for in a terminal is a swap you stop trusting. Every successful
one draws a short banner over the running app:

```
Refreshing native   ProbeValues.kt
Refreshing native   ProbeValues.kt · reloaded    ← a generation, so React rebuilt its instance
```

A violet pill, deliberately not React Native's blue bar, because the two can appear together
and you want to know at a glance which half of the app just changed. It is drawn by hotswap
itself rather than through React Native's dev UI, so it needs no integration and looks the
same on both platforms.

Nothing is drawn when a swap fails — the terminal carries the reason, and a banner that
appears either way teaches you to ignore it.

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
  ✅ ios target         probe in example/ios/HotswapExample.xcworkspace
```

`agent reachable` failing usually means the app is not running, or the build was not
debuggable.

## What it can change

More than you would expect. ART's structural redefinition — Android 11 and up — is not
limited to method bodies:

| Change                              | Works                       |
| ----------------------------------- | --------------------------- |
| Method body                         | ✅                          |
| **New method on an existing class** | ✅                          |
| **New field on an existing class**  | ✅                          |
| New top-level function              | ✅                          |
| **A class in a new file**           | ⛔ not in the installed apk |
| **Removing** a method or field      | ⛔ ART never allows it      |
| Changing a Nitro spec               | ⛔ refused, with a message  |

A class in a new file is the other one. The swap of whatever references it succeeds — ART
takes the redefinition — and then the app throws `NoClassDefFoundError` the moment that code
runs, because the new class was never in the apk. Measured, not assumed: this page claimed
the opposite until the example was pointed at it.

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
  ⛔ ProbeValues.kt  src/specs/probe.nitro.ts changed; run codegen and rebuild
```

## What it cannot change

- **A function shorter than sixteen bytes, on Android.** The redirect is written over the
  original's entry and needs the room. It is reported and skipped, never written past.
- **A file the native build does not compile.** The command comes from the project's own
  `compile_commands.json`, so a file no target lists has nothing to derive flags from.
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
- **Static initialisers run again.** A swapped translation unit is loaded, so anything it
  constructs at load time is constructed a second time. Keep one-time setup out of the file
  you are editing, or expect it twice.
- **A Swift top-level function.** The replacement is emitted as an extension, so it needs a
  type to extend. Methods on a `class`, `struct`, `enum`, `actor` or `extension` all swap.
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
| Languages   | Kotlin and C++ on Android; Swift and C++ on iOS  |
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
| A library may never be extracted from the apk               | the symlink points at the apk instead, and the linker reads `archive!/entry`                  |
| `FindClass` on the agent thread sees only the system loader | app classes are found by walking `GetLoadedClasses`                                           |
| ART accepts exactly one class def per dex                   | each class travels in its own dex, sent as one atomic batch                                   |

### iOS, and why it is shaped this way

A changed Swift file is rewritten as one extension of `@_dynamicReplacement` methods per type
it declares, written into `ios/HotswapPatch.swift`, compiled by Xcode, and linked alone into a
dylib. Three attempts got there:

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

### C++ on iOS, and the two ways a call finds its target

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

### C++ on Android, which turned out to be the easy one

The same edit on Android takes one write instead of two, and lands in about half a second.

A freshly compiled `.so` is delivered into the app's own data directory and loaded there,
then an absolute branch is written over each changed function's entry:

```
ldr x16, #8
br  x16
.quad <the new function>
```

Because the branch sits at the original's **entry** rather than at its call sites, one write
covers every way a call arrives — a direct PC-relative call, a PLT entry, a vtable slot. iOS
needs a vtable scan precisely because dynamic replacement cannot do this.

It also means a second swap needs no bookkeeping: the entry is overwritten again, and the
symbol table still reports the same address it always did. The registry iOS needs has no
counterpart here.

Two things make it honest rather than lucky:

- **Sixteen bytes have to belong to the function.** The room is measured on the unstripped
  library the app was actually built from, not on the patch — an edit that grows a function
  would otherwise report space the running code does not have. Too short is reported and
  skipped.
- **The compile command is the project's own.** It comes out of `compile_commands.json`, so
  the defines, include paths and flags are the ones the installed code was built with.

```
baseline  free=10 virtual=1
swap 1    free=555 virtual=777       519ms
swap 2    free=42  virtual=31337     455ms
```

One more property falls out of this: a `.cpp` in a Nitro module is compiled into both apps,
so one save swaps both. Measured with both running, from a single save:

```
  ✅ cpp/HotswapProbeImpl.cpp  481ms      (android, pid unchanged)
  ✅ cpp/HotswapProbeImpl.cpp  6740ms     (ios, pid unchanged)
```

Only the platforms actually listening are attempted, so working against one simulator does
not print a failure for a device that was never started.

### Why not build tools 37

d8 from build-tools 37 drops `ACC_PRIVATE` from the synthetic methods Kotlin generates for
lambdas. ART compares the incoming class against the installed one and refuses the mismatch
with `jvmtiError 71`. Versions 34 through 36 preserve the flag.

hotswap reads `buildToolsVersion` from your build and, failing that, picks the newest version
at or below 36.

## Trying it

`example/` in this repository is a React Native app with its own native code, and
`example/probe` is a module it depends on. Both are wired up, so the fastest way to see any of
this is to run it and edit one of the files the app lists on screen.

```bash
cd example && npm install && npx react-native start
```

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
