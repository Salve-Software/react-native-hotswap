# What was already tried

Every entry here was built, run and rejected. Reading this is cheaper than repeating it.

## Swift, replacing a method

| Attempt                                                               | What happened                                                  |
| --------------------------------------------------------------------- | -------------------------------------------------------------- |
| Reproduce `swiftc`'s invocation by hand                               | each missing header search path revealed another, forever      |
| Link the module's objects into a dylib                                | a second copy of the module's Swift metadata, and the app dies |
| **Generate an extension, let Xcode compile it, link that one object** | works, and is what ships                                       |

The lesson generalised: **capture the compiler invocation, never reconstruct it.** The same
answer solved iOS generations (read the `swiftc` line out of a build log and change only
`-module-name`) and Android C++ (read `compile_commands.json`).

## Loading native code on Android

The file claimed W^X blocked `dlopen` from app storage, and the claim was wrong. A probe tried
four routes in the running app:

| Route                                      | Result                         |
| ------------------------------------------ | ------------------------------ |
| **plain `dlopen` from the app's data dir** | **works** — this is what ships |
| `memfd_create` + `android_dlopen_ext`      | works                          |
| anonymous RW then RX memory                | works                          |
| `mprotect` over existing text              | works                          |

The original conclusion came from a library that had never been extracted from the apk: a
missing file and a refused load were read as one failure. **When two things can explain a
failure, separate them before concluding.**

## Redirecting a C++ function on Android

| Attempt                                                    | What happened                                                        |
| ---------------------------------------------------------- | -------------------------------------------------------------------- |
| 16-byte absolute jump                                      | a function returning a constant is 8 bytes — 5 of 11 symbols refused |
| 4-byte `b` straight to the patch                           | the patch maps further than imm26's 128MB                            |
| **4-byte `b` to a trampoline allocated near the original** | works                                                                |

Every arm64 function is at least 4 bytes, so with a trampoline in reach nothing is too small.

## Holding two versions of a class

| Attempt                                                       | What happened                               |
| ------------------------------------------------------------- | ------------------------------------------- |
| Subclass `InMemoryDexClassLoader` and go child-first          | the class is `final`                        |
| Let the generation's loader delegate normally                 | the parent has the apk copy and always wins |
| **A filtering parent that refuses the module's own packages** | works                                       |

On iOS the same problem has a different answer: compile each generation as its own Swift
module, so the types are genuinely distinct instead of colliding. Objective-C has no
equivalent and genuinely collides.

## Choosing between patching and a generation

| Attempt                                               | What happened                                                                                                           |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Inspect the edit in the CLI to classify it            | needs a Kotlin and a Swift parser, and is wrong the moment either language grows                                        |
| On iOS, fall back when the patch **fails to compile** | never fires: `buildDylib` runs xcodebuild against the source as it stands, so a method added a second ago compiles fine |
| **Let the runtime answer**                            | works, and is the design                                                                                                |

ART's refusal codes on Android; "would not load" or "replaced nothing" on iOS. The thing that
is running is the only thing that knows what is loaded.

## A Swift TurboModule

| Attempt                                                                 | What happened                                                                     |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Swift class conforming to the generated spec, `import ReactCodegen`     | the generated umbrella is C++; Swift cannot import it                             |
| `RCT_EXTERN_MODULE` so the class registers itself                       | registers in React Native's global registry, and the delegate is then never asked |
| **Objective-C++ conformance, logic in a Swift class asked for by name** | works                                                                             |

## Getting an Activity to draw a banner on

| Attempt                                                           | What happened                                               |
| ----------------------------------------------------------------- | ----------------------------------------------------------- |
| `registerActivityLifecycleCallbacks` from the agent's attach path | React builds its packages after `onResume`, so it is missed |
| Seed from `ReactContext.currentActivity` at package creation      | still null in bridgeless at that point                      |
| **A `ContentProvider` in the AAR manifest**                       | runs before any Activity, so every resume is seen           |

Both failures look identical from the terminal: the swap succeeds, the reply byte is 0, and
nothing appears. The first notice of a fresh process is the case to test, because every later
one works by then.

## Claims that were written here and were false

Kept because each was believed, written down, and only disproved by measuring:

- _"W^X blocks `dlopen` from app storage."_ It does not.
- _"A class in a new file loads normally."_ It throws `NoClassDefFoundError`, after the swap
  has already reported success.
- _"An app's own code cannot have generations."_ It can. It needs a `ReactPackage`, which is
  how an app exposes native code anyway.
- _"`__swift5_replace` is how a replacement announces itself."_ Not for an `@objc` class,
  where the extension becomes an Objective-C category — so those swaps worked while reporting
  that they had changed nothing.

## Traps that recur

- **`pod install` after creating any file.** CocoaPods globs at install time. This has cost
  three separate debugging sessions.
- **The watcher holds the `lib/` it imported at Metro start.** Rebuilding the CLI does nothing
  until Metro restarts.
- **Reading an exit code through a pipe** reports the exit code of `tail`. Write it to a file
  and read that.
- **A background `xcodebuild` locks the build database.** Two builds in the same derived data
  fail with "database is locked".
