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
2. **Compile a generation.** Reuse what already compiles a module, emit a dex per generation.
3. **Drive the reload.** Publish, then ask `ReactHost` to reload, then report what changed.
4. **Fall back honestly.** A change that patching handles should still be patched: it is
   faster and it keeps objects. Generations are for what patching cannot do.
5. **iOS.** A Swift module per generation, reached through a factory.

Patching does not go away. It becomes the fast path.
