# react-native-hotswap

Swaps the native side of a running React Native app without reinstalling it — Kotlin and C++
on Android, Swift and C++ on the iOS simulator. Save the file, the code is replaced in place,
the app keeps its state.

A JVMTI agent rides inside the app; a watcher on the dev machine compiles and ships each
edit. Installing the package and adding two lines to `metro.config.js` is the whole setup.

Nothing in the agent knows what a Nitro module is, so an app's own Kotlin swaps just as well
— verified on `MainActivity`. Nitro is the first-class target because its spec makes the
safety check mechanical, not because the mechanism needs it.

## The five rules that are not negotiable

1. **Never in a release build.** The agent attaches only when `FLAG_DEBUGGABLE` is set, and
   ART refuses otherwise anyway. A swap path that could reach production is a bug.
2. **Refuse rather than guess.** If the Nitro spec changed, the ABI changed and the C++ is
   stale — say so and demand a rebuild. A swap that half-works is worse than none, because
   the developer stops trusting the screen and reinstalls on every save.
3. **Every failure is loud.** A silent no-op teaches people the tool is unreliable. Print the
   `jvmtiError`, print the file, print the elapsed time.
4. **The device compiles nothing.** `kotlinc` and `d8` run on the dev machine. The agent only
   receives bytes and calls ART.
5. **Synthetic classes travel with their owner.** A Kotlin lambda or coroutine body becomes
   its own class; redefining the outer one alone leaves the runtime on stale code.

## What the platform actually allows

These cost hours to find and none of them are in the documentation:

| Fact                                                        | Consequence                                                                                           |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `Debug.attachJvmtiAgent` rejects any path containing `=`    | every install dir is base64 and ends in `==`, so the agent is reached through a symlink in `filesDir` |
| A library may never be extracted from the apk               | the symlink points at the apk instead, and the linker reads `archive!/entry`                          |
| `dlopen` from the app's own data directory is **allowed**   | measured on API 36; the opposite was written here for weeks and was wrong                             |
| ART does not grant `can_redefine_any_class`                 | capabilities are negotiated against `GetPotentialCapabilities`, never demanded                        |
| `FindClass` on the agent thread sees only the system loader | app classes are found by walking `GetLoadedClasses`                                                   |
| Modern AGP maps `.so` straight out of the APK               | the app must set `useLegacyPackaging = true`, or there is no file path to attach                      |
| The NDK ships `jni.h` but not `jvmti.h`                     | the ART header is vendored in `android/src/main/cpp/vendor/`                                          |

## State

**Android works, and is proven.** Swapping `toPosture` in a Nitro module made the app report
a posture the Android implementation can never produce, in the same process, with no
reinstall. Around 1.3s from save to swapped, against 10–30s for a rebuild that also drops
the app's state.

**Structural redefinition works, and that is the whole ceiling question.** Adding a method
and a field to a class the app had already loaded, then calling both from a swapped method,
runs in the same process. Measured on `HybridUnfoldBridge`:

```
STRUCTURAL: getState called brandNewMethod() = 7
STRUCTURAL: new field reads 7
```

Removing is the asymmetry: adding a method is fine, taking one away is `jvmtiError 67` and
needs a rebuild. That turns an ordinary edit-then-undo into a dead end, so the CLI names it
instead of printing the code.

This matters because the JVMTI approach is usually described as method-bodies-only — that is
classic `RedefineClasses`. ART's structural extension, present from Android 11, lifts it.
Compose HotSwan moved off JVMTI to an interpreter over exactly this limit; the limit is real
for the old call and not for the extension.

**iOS replaces live Swift, through dynamic replacement.** Verified on the simulator: editing
a method, letting the generator rewrite it as `@_dynamicReplacement`, and loading the result
made the new body run in the same process.

The mechanism took three attempts and only the third works:

| Attempt                                                                          | Outcome                                                              |
| -------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Reproduce swiftc's invocation by hand                                            | endless drift; each missing header search path revealed another      |
| Link the module's objects into a dylib                                           | loads a second copy of the module's Swift metadata and kills the app |
| **Generate a replacement extension, let Xcode compile it, link that one object** | works                                                                |

Two constraints that come with it:

- **The patch file has to exist before `pod install`.** CocoaPods globs sources at install
  time, so `ios/HotswapPatch.swift` is created once and rewritten on every save.
- **Symbol rebinding is not the mechanism.** The rebinder is still there and still safe, but
  Nitro dispatches through a C++ vtable, so nothing names the Swift method in a way that could
  be rewritten. `@_dynamicReplacement` goes around that entirely.

**C++ swaps on the simulator, virtual methods included.** The changed translation unit is
included into a patch the pod globs, so Xcode compiles it with the target's own flags. Then
two mechanisms, because a call reaches its target two ways: a free function goes through a
symbol slot and is rebound, a virtual call reads the vtable and the pointer there is
overwritten. Measured in one process, no restart: `free=7 virtual=4242` to `free=11
virtual=22` to `free=33 virtual=44`, the second swap in 3.1s.

Two traps that cost the evening. Only symbols in executable sections are taken over, or a
global in the edited file has its pointers aimed at a fresh copy and loses its state. And
what a swap installs has to be remembered: a patched vtable slot no longer holds the address
the symbol table reports, so the second swap of a method finds nothing and the first swap's
code keeps running.

The reach is the images' data sections, not all of memory. That covers a vtable and misses a
function pointer built on the heap, which is the honest limit to quote rather than "every
call site".

**Android C++ swaps too, and is the simpler half.** A freshly compiled `.so` is written into
the app's own data directory, loaded, and an absolute branch goes over each changed
function's entry. Because the branch sits at the entry and not at the call sites, one write
covers a direct call, a PLT entry and a vtable slot at once — and a second swap needs no
registry, since the symbol table still reports the address being overwritten. Measured:
`free=10 virtual=1` to `555/777` in 519ms to `42/31337` in 455ms.

The claim that W^X blocked this was wrong, and worth remembering as a method failure rather
than a fact: the library that failed to load had never been extracted from the apk, so a
missing file and a refused load were read as one thing. The probe that settled it tried four
routes — plain `dlopen`, `memfd_create` with `android_dlopen_ext`, anonymous RW-then-RX
memory, and `mprotect` over existing text. The first one worked.

Sixteen bytes have to belong to the function, and the room is measured on the unstripped
library the app was built from — the patch's own size would overstate it whenever an edit
makes a function grow.

Every swap links its dylib under a new name. dyld keys a loaded image on its install name, so
a second `patch.dylib` came back as the handle of the first and the new file was never mapped
— which looked like the replacement silently failing on every save after the first.

## Mandatory rules

@rules/architecture.md
@rules/code-structure.md
@rules/comments.md
@rules/testing.md
@rules/tooling.md
