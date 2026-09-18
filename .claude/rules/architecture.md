# Architecture

Two halves that never share a process, joined by a socket, and two mechanisms that share
nothing but that shape.

```
dev machine                          device
───────────                          ──────
src/  watch → gradle → d8        ─→  agent.cpp        → ART redefines the classes
src/  watch → generate → xcode   ─→  HotswapLoader.mm → dyld loads, swift replaces
src/  watch → include  → xcode   ─→  HotswapLoader.mm → rebind + patch vtables
src/  watch → ndk      → clang   ─→  native_swap.cpp  → dlopen, branch at each entry
metro.cjs  starts the watcher
```

## The split is not negotiable

**The device compiles nothing.** `kotlinc` and `d8` exist on the dev machine and nowhere
else. The agent receives a class name and a dex buffer, and its whole job is to hand them to
ART.

Anything that reasons about Gradle, file paths or Kotlin belongs in `src/`. Anything that
touches JVMTI belongs in `agent.cpp`. Neither imports the other's concerns.

## The agent is a guest in someone else's app

It runs inside an app it does not own, that a developer is actively debugging. That imposes
three constraints:

| Constraint                 | Why                                                                       |
| -------------------------- | ------------------------------------------------------------------------- |
| Never crash the host       | a failed swap logs and returns an error code; it never throws through JNI |
| Never attach in release    | gated on `FLAG_DEBUGGABLE`, and ART refuses regardless                    |
| Never hold the main thread | the socket runs on its own thread, and redefinition attaches its own      |

## Failure is a result, not an exception

Every swap resolves to a `jvmtiError`. Zero means the class was replaced; anything else is
reported with the file and the code. The CLI prints it and carries on watching.

**Silence is the one unacceptable outcome.** A developer who cannot tell whether a swap
landed will reinstall on every save, which is worse than not having the tool.

## What the spec buys

A Nitro module declares its bridge in `*.nitro.ts`, and nitrogen turns that into C++. So:

```
spec unchanged  →  the ABI is intact  →  swapping Kotlin is safe
spec changed    →  the C++ is stale   →  refuse, and say rebuild
```

That check is mechanical, which is why Nitro is the first-class target. A Turbo Module has
the same shape through its codegen spec. Plain app Kotlin has no such file, so the swap still
works and the guarantee is weaker.

## What each folder holds

| Folder                   | What it is                                                    |
| ------------------------ | ------------------------------------------------------------- |
| `android/src/main/cpp/`  | the JVMTI agent, and the vendored ART header it needs         |
| `android/src/main/java/` | the attach path: a ReactPackage and the agent loader          |
| `src/bin.ts`             | the executable entry point, argument handling only            |
| `src/hotswap.class.ts`   | the facade both entry points go through                       |
| `src/classes/`           | agent, configuration, watcher, and one swapper per mechanism  |
| `src/library/`           | the helpers more than one class needs                         |
| `gradle/`                | the init script that reads the app's minSdk and build-tools   |
| `metro.cjs`              | starts the watcher inside Metro so there is no second process |

## Maintenance rules

- **A platform is a mechanism, not a branch.** Android redefines classes through JVMTI; iOS
  loads a dylib of `@_dynamicReplacement` methods and lets the Swift runtime do the swap.
  `platformFor` routes, and nothing below it is shared.
- **Let the platform's own compiler produce the bytes.** Gradle dexes what it dexed before,
  Xcode compiles with the settings the app was built with. Reproducing either invocation by
  hand drifts, and the drift shows up as a redefinition the runtime rejects.
- **The agent never grows a protocol it does not need.** One request, one reply, one byte of
  status. Anything richer belongs on the CLI side.
- **Capabilities are asked for, never assumed.** ART grants a different set per version;
  `GetPotentialCapabilities` decides what to request.
- **C++ swaps on both, by different means.** Android loads a `.so` and writes a branch at the
  original's entry, which covers every call path in one write. iOS cannot write over its
  text, so it rebinds symbol slots and scans data sections for vtable pointers.
- **A call is reached two ways, and only one names a symbol.** Free functions and non-virtual
  methods go through a symbol slot; a virtual call reads the vtable, which holds the address
  directly. Patching at the callee's entry sidesteps the distinction, which is why the
  Android side is the shorter of the two.
- **The room for a redirect is measured on what is running**, never on the patch. An edit
  that grows a function would otherwise claim space the installed code does not have.
- **Config resolves against the module root**, never `process.cwd()` — Metro runs out of the
  example app.
