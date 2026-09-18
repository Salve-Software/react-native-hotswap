# Generations

The second mechanism. Patching rewrites code that is already loaded, which is fast and keeps
live objects, but the shape of a loaded class is fixed. You cannot remove a method, change a
superclass, or reference a class that was never in the apk. Those are not gaps to close one at
a time. They are what "rewrite in place" means.

So for those edits hotswap stops rewriting. It rebuilds the module, loads it beside what is
running, and asks React Native to build its next instance from it.

```
you save                     (edit, new file, deleted file, anything)
  → compile what moved
  → publish generation N+1   (classes loaded, libraries mapped)
  → React Native recreates its instance
  → JS re-renders
```

A generation is built from the current source, so what it contains is whatever the source says.
There is no case analysis and no per-change mechanism.

The trade is explicit. Patching keeps live objects and cannot change shape. A generation
changes shape and cannot keep objects: the classes from generation N are gone, so anything
holding one goes with them.

## Android

`ReactHostDelegate.reactPackages` is a property, and `ReactInstance` reads it in its
constructor:

```kotlin
// ReactInstance.kt:177
reactPackages.addAll(delegate.reactPackages)
```

`reload()` destroys the `ReactContext` and the `ReactInstance` and builds a new one, so that
getter runs again. A delegate that builds its packages from a fresh class loader hands the new
instance classes that did not exist a moment earlier. That is React Native's own contract, not
a hole in it, and it is the whole mechanism here.

The app's side is one line:

```kotlin
override val reactHost: ReactHost by lazy {
  HotswapReactHost.create(applicationContext) { PackageList(this).packages }
}
```

Measured on the example, same pid, no reinstall:

```
kotlin=1        thread 3922    the apk's reporter
kotlin=777777   thread 3957    the generation's, calling a class compiled after install
```

### The parent loader has to refuse

A class loader asks its parent first, and the module's classes are in the apk, so the parent
wins and the generation is never seen. `InMemoryDexClassLoader` is final, so you cannot
subclass it to go child-first. The filter lives in the parent instead: it refuses the module's
own packages and lets everything else through.

Mixing the two sources would give you two versions of a type that are not the same type, since
the runtime decides identity by loader.

### A native library belongs to one class loader

`System.loadLibrary` binds a library to the loader that called it. A generation owning a class
with native methods brings the app down on its `<clinit>`, because the second loader is refused
outright. Those classes stay in the app's loader, which the filter lets through.

Finding them is mechanical, since the dex marks them `ACC_NATIVE`. Today they are found by
scanning Kotlin source, which should be replaced by reading the flag.

### Where it stops

- **`MainApplication`, `MainActivity`, `AppDelegate`.** A React reload does not recreate them.
  They keep getting patched.
- **Native state inside the module.** Gone on every reload, by construction.
- **Threads a module started.** React Native tears down the modules it owns, but a thread is
  not its to stop. Both reporters above keep logging. A generation ends the code, not what the
  code spawned.

## iOS

`RCTHost.didReceiveReloadCommand` invalidates the `RCTInstance` and allocates a new one, so
module instances get recreated the same way. That half matches Android.

The other half does not, and the difference shapes the whole iOS side. There is no class
loader, and the Objective-C runtime keys a class on its name, so two generations of the same
class collide:

```
objc[78972]: Class Thing is implemented in both libgen1.dylib and libgen2.dylib.
             This may cause spurious casting failures and mysterious crashes.

generation 1: class=0x1028c80c0 value=1
generation 2: class=0x1028d80c0 value=2
objc_getClass("Thing") -> 0x1028c80c0       always the first
```

A factory exported by each dylib still reaches the right class, because the linker resolves it
inside the image. Anything that looks the class up by name is stuck on generation one, and the
runtime is right that casting across the two will fail.

Compiling each generation as its own Swift module removes the collision instead of routing
around it, because the module name mangles into the Objective-C name:

```
generation 1: objcName=Gen1.Thing value=1
generation 2: objcName=Gen2.Thing value=2          no warning at all
```

So on iOS a generation is a Swift module of its own, reached through an exported factory and
never by name.

### Capturing the swiftc line

A generation needs the whole module built, not one file. Building it outside Xcode is the
approach that already failed once for Swift, where every missing header search path revealed
another. It works when the invocation is captured rather than reconstructed: xcodebuild logs
the full `swiftc` line, which is the Swift counterpart of `compile_commands.json`.

Replayed against the real pod with nothing changed but the module name:

```
-module-name probe   ->   -module-name HotswapGen1

_$s11HotswapGen111ProbeValuesC5valueSiyF     the module is part of the mangled name
_probeSwiftValue                             @_cdecl stays a plain C symbol
```

The types are genuinely distinct from the app's `probe.ProbeValues`, which is what makes two
generations safe to hold at once. The factory is reached with `dlsym` on the handle, so the
duplicate C name across images never has to resolve globally.

Three things are dropped from the captured line, and one of them is a real limit:

| Dropped                          | Why                                                                                                      |
| -------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Xcode's output paths             | they point into a build the generation is not part of                                                    |
| `-emit-const-values` and friends | they write where Xcode expects, not where we do                                                          |
| **`-import-underlying-module`**  | it looks for an Objective-C module named after `-module-name`, and a generation's name is new every time |

That last one means Swift reaching the pod's own Objective-C headers through the underlying
module will not compile this way.

Capturing has a wrinkle. `-dry-run` is gone from xcodebuild, and a build that recompiles
nothing prints no invocation, so the patch file is touched to force the module into the build.
The result is kept, and the next generation does not pay for it:

```
generation 1   3172ms    build, capture, replay
generation 2    275ms    replay
```

A generation is therefore faster than the Swift patch path, which is around six seconds.
Patching goes through Xcode on every save, and a generation replays swiftc directly.

### What the delegate hook reaches

React Native asks `getModuleClassFromName:` for every module it resolves through its delegate,
so hotswap gets first refusal on all of them. Instrumented on the example, one launch:

```
41 calls: AccessibilityManager, AppState, BlobModule, DevMenu, Networking, ...
```

Returning nil falls through to React Native's own provider, so the hook does nothing until a
generation exposes the name being asked for.

It does not reach a module registered the old way. A class exported with `RCT_EXPORT_MODULE` or
`RCT_EXTERN_MODULE` comes from React Native's global registry and the delegate is never
consulted. Verified by adding one and watching it never appear among the names, while
`getModuleInstanceFromClass:` only ever saw `RCT*` classes.

So an iOS generation replaces TurboModules. A legacy module keeps whatever the app was built
with.

### Through a real TurboModule

The example carries a codegen'd module, called from JS, with a method added since the app was
installed:

```
Probe module comes from: apk
  ↻ ios/ProbeValues.swift  the running app has nothing to replace
  ♻️  ios/ProbeValues.swift  reloaded from a new generation  498ms
Probe module comes from: generation (246810)
```

246810 comes from a method that did not exist at install time, reached through React Native's
own module resolution, in the same process.

The shape that forces: a spec conformance has to be Objective-C++ and a generation compiles
Swift, so the module class stays put and the logic it calls is a Swift class asked for by name.
`example/probe/ios/Probe.mm` is four lines of that pattern. An iOS module has to adopt it;
hotswap cannot hide it.

### Patching stops after a generation

A generation is its own Swift module, so its types are not the ones a replacement names. Once
one is live, a patch lands on classes nothing is using and reports that it replaced nothing. So
the iOS side stops patching after it publishes, which costs little, since a generation is the
faster of the two there.

ART has no such split. A redefinition reaches every loaded copy of a class, so Android keeps
its fast path for as long as the edit allows.

## What it costs

- **JS state.** React rebuilds its instance, so the app goes back to its first screen.
- **Old dylibs stay mapped on iOS.** `dlclose` is not reliable with Swift metadata, so every
  generation leaks. Fine in development, but worth saying out loud.
- **Objective-C modules collide.** Their class names carry no module, so two generations are
  genuinely the same name. They either go through the factory and tolerate the warning, or stay
  on patching.

## How the choice is made

Patching runs first because it keeps live objects. Nothing inspects the edit to classify it:
the running app reports and the CLI reads.

```
  ✅ ProbeValues.kt  1234ms                                    body changed, patched
  ↻ BornAtRuntime.kt  class not loaded yet                     patch refused
  ♻️ BornAtRuntime.kt  reloaded from a new generation  942ms   published instead
```

On Android that is ART's refusal code. On iOS it is the dylib either failing to load or
replacing nothing, which mean the same thing. An earlier version tried to classify the edit in
the CLI, which needs a Kotlin parser and a Swift parser and is wrong the moment either language
grows.
