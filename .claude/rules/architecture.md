# Architecture

Two halves that never share a process, joined by a socket. On the device side there are two
mechanisms, and on the dev side one ladder that chooses between them.

```
dev machine                            device
───────────                            ──────
src/  watch → gradle → d8          ─→  agent.cpp        → ART redefines the classes
src/  watch → ndk → clang          ─→  native_swap.cpp  → dlopen, branch at each entry
src/  watch → generate → xcode     ─→  HotswapLoader.mm → dyld loads, swift replaces
src/  watch → include → xcode      ─→  HotswapLoader.mm → rebind + patch vtables
src/  watch → gradle → d8 (whole)  ─→  HotswapGenerations.kt → a loader of its own, reload
src/  watch → swiftc (whole)       ─→  HotswapGenerations.mm → dlopen, factory, reload
src/  after any success            ─→  HotswapNotice.kt / .mm → a banner over the app
metro.cjs  starts the watcher, one per root
```

## The ladder, and who decides

Patching runs first because it keeps live objects. When it cannot carry an edit, a generation
does. **Nothing classifies the edit** — the runtime reports and the CLI reads:

```
ART returns 21, 63, 66, 67, 70, 71  →  publish a generation
iOS: would not load, or replaced nothing  →  publish a generation
```

This is deliberate and load-bearing. Classifying an edit means parsing Kotlin and Swift and
being wrong the moment either language grows; the running app already knows what is loaded.
`rules/history.md` records the version that tried to classify.

## The split is not negotiable

**The device compiles nothing.** Every compiler runs on the dev machine. The agent receives
bytes and hands them to the runtime.

Anything that reasons about Gradle, file paths or a language belongs in `src/`. Anything that
touches JVMTI belongs in `agent.cpp`. Neither imports the other's concerns.

## The agent is a guest in someone else's app

| Constraint                 | Why                                                                  |
| -------------------------- | -------------------------------------------------------------------- |
| Never crash the host       | a failed swap logs and returns a code; it never throws through JNI   |
| Never attach in release    | gated on `FLAG_DEBUGGABLE`, and ART refuses regardless               |
| Never hold the main thread | the socket runs on its own thread, and redefinition attaches its own |

## Failure is a result, not an exception

Every swap resolves to a status. Zero means the running app changed; anything else is reported
with the file and the reason.

**Silence is the one unacceptable outcome**, and so is a green line that did not happen. Both
teach the developer to stop trusting the screen, which is worse than not having the tool.

## What a generation needs from the app

A generation replaces classes, so something has to ask for them **after** it is published.
React Native already does, which is why both integrations are one line:

| Platform | Hook                      | Why it works                                                                                            |
| -------- | ------------------------- | ------------------------------------------------------------------------------------------------------- |
| Android  | `HotswapReactHost.create` | `ReactInstance` reads `delegate.reactPackages` in its constructor, and `reload()` builds a new instance |
| iOS      | `getModuleClassFromName:` | the factory asks the delegate for every module it resolves, and nil falls through                       |

Without them, patching still works and generations do not. That is the whole cost of the
integration, and it is stated that way in the README.

The banner asks for nothing at all. Android installs it from a `ContentProvider` in the AAR's
manifest, which runs before any Activity exists; iOS puts it in a `UIWindow` of its own above
the app's, so a generation's reload does not take it down with the React instance.

## What each folder holds

| Folder                   | What it is                                                          |
| ------------------------ | ------------------------------------------------------------------- |
| `android/src/main/cpp/`  | the JVMTI agent, the C++ redirector, and the vendored ART header    |
| `android/src/main/java/` | attach path, generation loader, and the React host                  |
| `ios/`                   | the loader, the Mach-O rebinder, and the generation registry        |
| `src/bin.ts`             | the executable entry point, argument handling only                  |
| `src/hotswap.class.ts`   | the facade both entry points go through                             |
| `src/classes/`           | agent, configuration, watcher, generation, notice, one swapper each |
| `src/library/`           | the helpers more than one class needs                               |
| `gradle/`                | the init script that reads the app's minSdk and build-tools         |
| `metro.cjs`              | starts the watcher inside Metro so there is no second process       |
| `example/`               | the app; `example/probe` is the module. Both are swap fixtures      |
| `docs/generations.md`    | the long form of the generation design, with measurements           |

## Maintenance rules

- **A platform is a mechanism, not a branch.** `platformsFor` routes and returns a list,
  because a shared `.cpp` belongs to both.
- **Let the platform's own compiler produce the bytes**, and capture its invocation rather
  than reconstructing it. Reconstruction drifts; see `rules/history.md`.
- **The agent never grows a protocol it does not need.** A kind byte, a payload, one byte of
  status. The notice kind earns its place by being the only way the developer sees a swap
  without reading the terminal.
- **The device draws what it is handed.** The banner's wording is built in the CLI, so it is
  written once instead of once per language.
- **Capabilities are asked for, never assumed.** ART grants a different set per version.
- **A call is reached two ways, and only one names a symbol.** A virtual call reads the
  vtable. Patching at the callee's entry sidesteps the distinction, which is why the Android
  C++ side is the shorter of the two.
- **The room for a redirect is measured on what is running**, never on the patch.
- **A generation owns whole packages, and cannot own a class with native methods.**
  `System.loadLibrary` binds a library to the loader that called it.
- **Config resolves against the module root**, never `process.cwd()` — Metro runs out of the
  app, and the watcher takes several roots.
