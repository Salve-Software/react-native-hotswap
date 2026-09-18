# react-native-hotswap

Swaps the Kotlin side of a running React Native app without reinstalling it. Save the file,
the class is replaced in place, the app keeps its state.

A JVMTI agent rides inside the app; a watcher on the dev machine compiles and ships each
edit. Installing the package and adding two lines to `metro.config.js` is the whole setup.

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

| Fact                                                        | Consequence                                                                                             |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `Debug.attachJvmtiAgent` rejects any path containing `=`    | every install dir is base64 and ends in `==`, so the agent is reached through a symlink in `filesDir`   |
| W^X blocks `dlopen` from app data                           | the symlink resolves into the apk lib dir, which keeps the `apk_data_file` label that permits execution |
| ART does not grant `can_redefine_any_class`                 | capabilities are negotiated against `GetPotentialCapabilities`, never demanded                          |
| `FindClass` on the agent thread sees only the system loader | app classes are found by walking `GetLoadedClasses`                                                     |
| Modern AGP maps `.so` straight out of the APK               | the app must set `useLegacyPackaging = true`, or there is no file path to attach                        |
| The NDK ships `jni.h` but not `jvmti.h`                     | the ART header is vendored in `android/src/main/cpp/vendor/`                                            |

## State

**Android works, and is proven.** Swapping `toPosture` in a Nitro module made the app report
a posture the Android implementation can never produce, in the same process, with no
reinstall. Around 1.3s from save to swapped, against 10–30s for a rebuild that also drops
the app's state.

**Two things are open:**

| Open                              | Detail                                                                   |
| --------------------------------- | ------------------------------------------------------------------------ |
| Nitro implementation classes fail | `jvmtiError 103` on `HybridUnfoldBridge`; plain Kotlin classes swap fine |
| Autolinking skips the package     | the example force-links it through `react-native.config.js`              |

**iOS is not started.** The mechanism is different — a recompiled dylib plus linker
interposing — and the prior art is MIT. It covers Swift, Objective-C and C++ through one
pipeline, unlike Android where each needs its own.

## Mandatory rules

@rules/architecture.md
@rules/code-structure.md
@rules/comments.md
@rules/testing.md
@rules/tooling.md
