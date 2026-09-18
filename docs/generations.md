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
- **iOS is not solved by this note.** There is no class loader. The equivalent is a dylib per
  generation, and class identity in the Objective-C and Swift runtimes is decided by name,
  not by the image a class came from. Needs its own investigation before any promise.
- **Native state inside the module.** Gone on every reload, by construction.

## Order of work

1. ~~**Prove the loader.**~~ Done, above.
2. **Compile a generation.** Reuse what already compiles a module, emit a dex per generation.
3. **Drive the reload.** Publish, then ask `ReactHost` to reload, then report what changed.
4. **Fall back honestly.** A change that patching handles should still be patched: it is
   faster and it keeps objects. Generations are for what patching cannot do.
5. **iOS.** Investigate before scoping.

Patching does not go away. It becomes the fast path.
