# Architecture

Two halves that never share a process, joined by a socket, and two mechanisms that share
nothing but that shape.

```
dev machine                          device
───────────                          ──────
cli/  watch → gradle → d8        ─→  agent.cpp        → ART redefines the classes
cli/  watch → generate → xcode   ─→  HotswapLoader.mm → dyld loads, swift replaces
metro.cjs  starts the watcher
```

## The split is not negotiable

**The device compiles nothing.** `kotlinc` and `d8` exist on the dev machine and nowhere
else. The agent receives a class name and a dex buffer, and its whole job is to hand them to
ART.

Anything that reasons about Gradle, file paths or Kotlin belongs in `cli/`. Anything that
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
| `cli/bin/`               | the executable entry point                                    |
| `cli/src/library/`       | one function per file: resolve, compile, send, watch          |
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
- **C++ is out of scope, on purpose.** Loading a recompiled `.so` needs root and an ELF
  rebinder, and in a Nitro module the C++ is generated from the spec — which already forces a
  rebuild when it changes. Revisit only if hand-written C++ HybridObjects become common.
- **Config resolves against the module root**, never `process.cwd()` — Metro runs out of the
  example app.
