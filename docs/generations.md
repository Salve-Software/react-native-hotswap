# Generations

The plan for making any native change reload, including the ones patching cannot reach.

## Why patching runs out

What ships today rewrites code in place: ART redefines a class, a branch goes over a C++
function's entry, Swift's dynamic replacement swaps a body. Each is fast and keeps live
objects, and each stops at the same wall — the shape of a class cannot change. A method
cannot be removed, a superclass cannot change, and a class in a new file was never in the apk
to begin with.

These are not gaps to close one at a time. They are what "rewrite in place" means.

## The shape

Stop rewriting. Publish a **generation** and recreate what depends on it.

```
you save                     (anything: edit, new file, deleted file)
  → compile only what moved
  → publish generation N+1   (its classes loaded, its libraries mapped)
  → React Native recreates its instance
  → JS re-renders
```

Nothing is stitched into anything. A generation is built from the current source, so what it
contains is whatever the source says — no case analysis, no per-change mechanism.

## What makes it possible

`ReactHostDelegate.reactPackages` is a property, and `ReactInstance` reads it in its
constructor:

```kotlin
// ReactInstance.kt:177
reactPackages.addAll(delegate.reactPackages)
```

`reload()` destroys the `ReactContext` and the `ReactInstance` and builds a new one, so that
getter runs again. A delegate that builds its packages from a fresh class loader hands the
new instance a set of classes that did not exist a moment earlier.

That is the whole mechanism on Android, and it is RN's own contract rather than a hole in it.

## Measured, on the example

A generation dex loaded into the running app, with no reinstall and the same pid:

```
GENERATION answer=1         fromApk=false   generation one
GENERATION answer=20260918  fromApk=false   generation two, calling a class the apk never had
```

The second generation's `Generation.answer()` calls a `Helper` compiled after the app was
installed. Under patching that same edit reports success and then throws
`NoClassDefFoundError`. `fromApk=false` is the part that matters: the class came from the
generation, so the apk copy never won.

## Class identity, which is the part that bites

A child loader delegates to its parent first, and the module's classes are in the apk, so the
parent would win and the new generation would never be seen.

So the module's classes come from a **generation dex and never from the apk**, through a
child-first loader. Generation zero is extracted at first run; every generation after is
compiled from source. Mixing the two would mean two versions of a type that are not the same
type, in a runtime that decides identity by loader.

Live objects from generation N are not carried into N+1. They cannot be: their class is
gone. This is the trade the design makes on purpose — patching keeps objects and cannot
change shape, generations change shape and cannot keep objects.

## Where it stops

- **`MainApplication`, `MainActivity`, `AppDelegate`.** A React reload does not recreate
  them. They keep needing patching, or an activity recreate.
- **Objective-C modules.** See below: they collide by name where Swift does not.
- **Native state inside the module.** Gone on every reload, by construction.

## Driven through React Native's own reload

Measured end to end, same pid, no reinstall:

```
kotlin=1        thread 3922    the apk's reporter
kotlin=777777   thread 3957    the generation's, calling a class compiled after install
```

`HotswapReactHost` builds a `ReactHostImpl` with a delegate whose `reactPackages` getter runs
per instance. Publishing a generation and calling `reload()` gives the new instance the
generation's packages, and RN instantiates them itself.

The app's side of this is one line:

```kotlin
override val reactHost: ReactHost by lazy {
  HotswapReactHost.create(applicationContext) { PackageList(this).packages }
}
```

### A native library belongs to one class loader

`System.loadLibrary` binds the library to the loader that called it, so a generation owning a
class with native methods brings the app down on its `<clinit>` — the second loader is
refused outright.

Those classes stay in the app's loader, which the generation's filter lets through. It is a
real constraint on the boundary, not a detail: **a class with native methods cannot belong to
a generation.** Finding them is mechanical — the dex marks them `ACC_NATIVE` — so this should
be derived rather than configured.

### The ladder, measured

One save each, same pid, watcher driving:

```
  ✅ ProbeValues.kt  1234ms                                    body changed, patched
  ↻ BornAtRuntime.kt  class not loaded yet                     patch refused
  ♻️ BornAtRuntime.kt  reloaded from a new generation  942ms   published instead
```

The second file did not exist when the app was installed. Patching is tried first because it
keeps live objects; the refusal code is what decides, so the CLI never has to work out what
kind of edit it is looking at.

### The old generation does not stop by itself

Both reporters above are still logging. RN tears down the modules it owns, but a thread a
module started is not RN's to stop. Generations end the code, not what the code spawned.

## iOS

Both halves hold there too, for different reasons than on Android.

`RCTHost.didReceiveReloadCommand` invalidates the `RCTInstance` and allocates a new one, so
module instances are recreated the same way. That is the half that matches.

The other half does not match, and the difference is the whole iOS design. There is no class
loader, and the Objective-C runtime keys a class on its name — so two generations of the same
class collide:

```
objc[78972]: Class Thing is implemented in both libgen1.dylib and libgen2.dylib.
             This may cause spurious casting failures and mysterious crashes.

geracao 1: class=0x1028c80c0 value=1
geracao 2: class=0x1028d80c0 value=2
objc_getClass("Thing") -> 0x1028c80c0       ← always the first
```

A factory exported by each dylib still reaches the right class, because the linker resolves
it inside the image. But anything that looks the class up **by name** is stuck on generation
one forever, and the runtime is right that casting across the two will fail.

Compiling each generation as its own Swift module removes the collision rather than routing
around it — the module name mangles into the Objective-C name:

```
geracao 1: objcName=Gen1.Thing value=1
geracao 2: objcName=Gen2.Thing value=2          no warning at all
```

So on iOS a generation is **a Swift module of its own**, reached through an exported factory
and never by name. Cleaner than the Android side, where the collision is real and the parent
loader has to refuse the apk copy.

### Compiling one, measured on the example

A generation needs the whole module built, not one file, and building it outside Xcode is the
approach that already failed once for Swift — every missing header search path revealed
another. It works when the invocation is not reconstructed but **captured**: xcodebuild logs
the full `swiftc` line, which is the Swift counterpart of `compile_commands.json`.

Replayed against the real pod with nothing changed but the module name:

```
-module-name probe   ->   -module-name HotswapGen1

_$s11HotswapGen111ProbeValuesC5valueSiyF     the module is part of the mangled name
_probeSwiftValue                             @_cdecl stays a plain C symbol
```

The types are genuinely distinct from the app's `probe.ProbeValues`, which is what makes two
generations safe to hold at once. The factory is reached with `dlsym` on the handle, so the
duplicate C name across images never has to be resolved globally.

Three things have to come out of the captured line, and one of them is a limit rather than
housekeeping:

| Dropped                          | Why                                                                                                      |
| -------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Xcode's output paths             | they point into a build the generation is not part of                                                    |
| `-emit-const-values` and friends | they write where Xcode expects, not where we do                                                          |
| **`-import-underlying-module`**  | it looks for an Objective-C module named after `-module-name`, and a generation's name is new every time |

The last one costs something real: Swift that reaches the pod's own Objective-C headers
through the underlying module will not compile this way. Worth knowing before promising the
iOS side works for any module.

The capture itself has a wrinkle: `-dry-run` is gone from xcodebuild, and a build that
recompiles nothing prints no invocation. So the patch file is touched to make the module one
of the things that build has to do, and the result is kept — the second generation does not
pay for it again:

```
generation 1   3172ms    build, capture, replay
generation 2    275ms    replay
```

That makes a generation faster than the Swift patch path, which is around six seconds,
because patching goes through Xcode every save and a generation replays swiftc directly.

### Measured, in the running app

```
  ↻ ios/ProbeValues.swift  declares no replaceable methods
  ♻️ ios/ProbeValues.swift  reloaded from a new generation  1840ms     swift=1 -> 31337
  ✅ ios/ProbeValues.swift  6176ms                                     body change, patched
```

The method the generation called did not exist when the app was installed, which is the thing
dynamic replacement cannot do. Same pid throughout.

### What the delegate hook reaches, measured

React Native asks `getModuleClassFromName:` for every module it resolves through its
delegate, and hotswap is given first refusal on all of them. Instrumented on the example, one
launch:

```
41 calls: AccessibilityManager, AppState, BlobModule, DevMenu, Networking, ...
```

Returning nil falls through to React Native's own provider, so the hook is inert until a
generation exposes the name being asked for.

What it does **not** reach is a module registered the old way. A class exported with
`RCT_EXPORT_MODULE` or `RCT_EXTERN_MODULE` is resolved from React Native's global registry,
and the delegate is never consulted for it — verified by adding one and watching it never
appear among the names, while `getModuleInstanceFromClass:` only ever saw `RCT*` classes.

So an iOS generation replaces TurboModules, and a legacy module keeps whatever the app was
built with. Worth knowing before promising the iOS side to a project that has them.

### Patching cannot follow a generation on iOS

A generation is its own Swift module, so its types are not the ones a replacement names: after
one is live, a patch lands on classes nothing is using any more and reports that it replaced
nothing. So the iOS side stops patching once it has published, which costs little — a
generation is the faster of the two there.

ART has no such split. A redefinition reaches every loaded copy of a class, so Android keeps
its fast path for as long as the edit allows it.

What this costs:

- **`RCT_EXPORT_MODULE` registers by name at load.** A module RN finds that way gets
  generation one. Instances have to come from a provider we control, which is the same
  requirement the Android side has.
- **Objective-C modules do not get the Swift trick.** Their class names do not carry a module,
  so two generations genuinely collide. Either they go through the factory and tolerate the
  warning, or they stay on patching.
- **Old dylibs stay mapped.** `dlclose` is not reliable with Swift metadata, so every
  generation leaks. Acceptable in development, and worth saying out loud.

## Order of work

1. ~~**Prove the loader.**~~ Done, above.
2. ~~**Compile a generation.**~~ Done: `buildGeneration` dexes the whole module, `readManifest`
   finds the packages it provides and the classes that must stay in the app's loader.
3. ~~**Drive the reload.**~~ Done, above.
4. ~~**Fall back honestly.**~~ Done. Patching runs first; ART's refusal is what chooses the
   generation, so nothing has to guess which kind of edit it is looking at.
5. ~~**iOS.**~~ Done. A Swift module per generation, reached through a generated factory,
   published over the same socket the patch dylibs use.

Patching does not go away. It becomes the fast path.
