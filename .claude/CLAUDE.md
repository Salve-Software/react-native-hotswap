# react-native-hotswap

Changes the native side of a running React Native app without reinstalling it. Kotlin and C++
on Android, Swift and C++ on the iOS simulator, in the app's own code and in the modules it
depends on.

There are **two mechanisms**, and knowing which one is talking is the first thing to establish
when reading any part of this repository.

|                    | Patching                                 | Generations                                                            |
| ------------------ | ---------------------------------------- | ---------------------------------------------------------------------- |
| What it does       | rewrites the code that is already loaded | builds the module again and loads it beside what is running            |
| Keeps live objects | yes                                      | no                                                                     |
| Changes shape      | no                                       | yes: new files, removed methods, new hierarchy                         |
| Costs              | nothing                                  | React Native rebuilds its instance, so JS state goes back to the start |
| Speed              | 0.4–6s                                   | 0.5–2s                                                                 |

**Patching is tried first, and the runtime decides when it is not enough.** Nothing in the CLI
inspects an edit to work out what kind it is. ART's refusal code on Android, and the app's own
"would not load / replaced nothing" on iOS, are what select a generation. That is the single
most important design decision here: _the thing that knows is the thing that is running._

`docs/generations.md` is the long form, including everything measured.

## The rules that are not negotiable

1. **Never in a release build.** The agent attaches only when `FLAG_DEBUGGABLE` is set, and
   ART refuses otherwise anyway. A swap path that could reach production is a bug.
2. **Refuse rather than guess.** A swap that half-works is worse than none, because the
   developer stops trusting the screen and reinstalls on every save.
3. **Every failure is loud.** A silent no-op teaches people the tool is unreliable. Print the
   code, the file and the elapsed time.
4. **The device compiles nothing.** Every compiler runs on the dev machine. The agent
   receives bytes and hands them to the runtime.
5. **Synthetic classes travel with their owner.** A Kotlin lambda becomes its own class;
   redefining the outer one alone leaves the runtime on stale code.
6. **Report what happened, not what was attempted.** `✅` means the running app changed. If
   that cannot be known, say so — see the `__objc_catlist` entry below for what happens when
   this slips.

## What the platforms actually allow

None of this is in any documentation, and each line cost hours:

| Fact                                                                                                 | Consequence                                                                                           |
| ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `Debug.attachJvmtiAgent` rejects any path containing `=`                                             | every install dir is base64 and ends in `==`, so the agent is reached through a symlink in `filesDir` |
| A library may never be extracted from the apk                                                        | the symlink points at the apk instead, and the linker reads `archive!/entry`                          |
| `dlopen` from the app's own data directory is **allowed**                                            | measured on API 36; this file claimed the opposite for weeks                                          |
| `FindClass` on the agent thread sees only the system loader                                          | app classes are found by walking `GetLoadedClasses`                                                   |
| ART does not grant `can_redefine_any_class`                                                          | capabilities are negotiated against `GetPotentialCapabilities`, never demanded                        |
| ART takes exactly one class def per dex                                                              | each class travels in its own dex, sent as one atomic batch                                           |
| `System.loadLibrary` binds a library to the loader that called it                                    | a class with native methods cannot belong to a generation                                             |
| A dex loader asks its parent first                                                                   | the generation's parent has to refuse the module's own packages, or the apk wins                      |
| dyld keys a loaded image on its install name                                                         | a reused dylib name comes back as the first handle and the new file is never mapped                   |
| An extension of an `@objc` class compiles to an ObjC category                                        | not to `__swift5_replace`, which is why those swaps once worked and reported nothing                  |
| `mmap` treats its address as a hint                                                                  | each candidate page is checked, never trusted                                                         |
| imm26 reaches 128MB, and a patch lands further                                                       | the branch goes to a trampoline allocated near the original                                           |
| Swift's `@objc` name carries the module                                                              | which is what makes two generations distinct types rather than a collision                            |
| `RCTReactNativeFactoryDelegate` conforms to `RCTTurboModuleManagerDelegate` only under `__cplusplus` | Swift cannot `override` the hook; the selector is written out                                         |
| CocoaPods globs sources at install time                                                              | a file created later is invisible until the next `pod install` — this has bitten three times          |
| React builds its packages after the first `onResume`                                                 | anything registered from a package misses it; the banner installs from a `ContentProvider`            |

## State

Everything below was measured in this repository, on `example/`. Numbers are from the run
that produced them.

**Android, patching.** Kotlin ~1.2s, C++ ~0.4s. Structural redefinition (API 30+) adds a
method and a field to a class already loaded. Removing a method is `jvmtiError 67` and is what
sends the edit to a generation.

**Android, generations.** A class created while the app was running resolves and runs, in the
module (`kotlin=777777`) and in the app's own code (`app=606060`), ~1s, same pid.

**iOS, patching.** Swift ~6s through `@_dynamicReplacement`, C++ ~4s through symbol rebinding
plus a vtable scan.

**iOS, generations.** ~0.5–2s, and _faster than patching_ because patching pays for Xcode on
every save while a generation replays `swiftc` directly. Proven through a real codegen'd
TurboModule called from JS: `Probe module comes from: generation (246810)`, where that number
comes from a method that did not exist at install time.

**Headers.** Editing a `.h` swaps every translation unit that reaches it.

**On screen.** Every successful swap draws a banner over the running app, from the first one
of a fresh process. Measured on both the emulator and the simulator, by save and by hand.

## What is not true, or not known

Read this before promising anything:

- **A generation loses JS state.** React Native rebuilds its instance, so the app returns to
  its first screen. Patching does not. This is inherent, not a bug to fix.
- **`MainActivity` and `MainApplication` never get generations.** A React reload rebuilds the
  React instance, not the Activity. They are patched.
- **Legacy iOS modules are not reached.** A class exported with `RCT_EXPORT_MODULE` comes from
  React Native's global registry and the delegate is never asked. Measured.
- **An iOS module needs a shape.** A spec conformance must be Objective-C++ and a generation
  compiles Swift, so the module class stays put and the logic it calls is a Swift class asked
  for by name. `example/probe/ios/Probe.mm` is that pattern.
- **Objective-C generations collide.** Only Swift gets the module-name mangling.
- **"Stopped patching" on iOS is session state.** Restart the watcher and it tries once more
  before publishing.
- **Nothing is tested end to end.** Every number above came from a human-driven run. The unit
  tests cover pure functions only, by design — see `rules/testing.md`.
- **It has never been installed from a tarball.** Everything so far used `file:` links into an
  example built alongside the library.

## Mandatory rules

@rules/architecture.md
@rules/code-structure.md
@rules/comments.md
@rules/history.md
@rules/testing.md
@rules/tooling.md
