# How it works

What each platform does, and what it cost to work out. The README is the short version.

```
your machine                          device
────────────                          ──────
metro.config.js  starts the watcher
  ↓ you save a .kt
gradle compiles the module
d8 dexes the class and its lambdas
  ↓ socket, port 8099
                                      agent.cpp
                                      ART redefines the classes, atomically
```

A JVMTI agent ships inside the package's AAR and attaches itself at app start through
`Debug.attachJvmtiAgent`. The CLI compiles through your own Gradle build, so the bytecode
matches what is already installed.

## Things Android does not document

Each of these cost an evening. They are written down so the next person does not pay again.

|                                                             |                                                                                               |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `Debug.attachJvmtiAgent` rejects any path containing `=`    | every install directory is base64 and ends in `==`, so the agent is reached through a symlink |
| A library may never be extracted from the apk               | the symlink points at the apk instead, and the linker reads `archive!/entry`                  |
| `FindClass` on the agent thread sees only the system loader | app classes are found by walking `GetLoadedClasses`                                           |
| ART accepts exactly one class def per dex                   | each class travels in its own dex, sent as one atomic batch                                   |

## Swift

A changed Swift file is rewritten as one extension per type it declares, full of
`@_dynamicReplacement` methods. That goes into `ios/HotswapPatch.swift`, Xcode compiles it, and
the single object is linked into a dylib.

Two earlier attempts did not survive:

| Attempt                                          | Outcome                                                           |
| ------------------------------------------------ | ----------------------------------------------------------------- |
| Reproduce swiftc's invocation                    | each missing header search path revealed another                  |
| Link the module's objects                        | loads a second copy of the module's Swift metadata, kills the app |
| **Generate, let Xcode compile, link one object** | works                                                             |

Symbol rebinding does not help here. Nitro dispatches through a C++ vtable, so nothing names
the Swift method in a way you could rewrite. Dynamic replacement goes around that.

Two traps:

- `ios/HotswapPatch.swift` has to exist before `pod install`, because CocoaPods globs sources
  at install time. It gets rewritten on every save.
- Each swap links a dylib under a new name. dyld keys a loaded image on its install name, so
  reusing a name hands back the first handle and leaves the old code running.

## C++ on iOS

The changed file is included into a patch the pod already globs, so Xcode compiles it with the
target's own flags and its relative includes keep resolving. No rewriting needed.

The work is on the other side. A call reaches its target in one of two ways, and only one of
them names a symbol:

| Call                              | How it is reached       | What swaps it                    |
| --------------------------------- | ----------------------- | -------------------------------- |
| Free function, non-virtual method | a symbol slot, via GOT  | rebinding, needs `-interposable` |
| **Virtual method**                | a pointer in the vtable | overwriting that pointer         |

A vtable holds the address directly and names nothing. That is how a virtual method kept
running its old body while a free function in the same file swapped correctly. So every
address the new image defines is looked up by name in the running images and overwritten in
their data sections, where vtables live. Only symbols in executable sections count. A global in
the edited file would otherwise get its pointers aimed at a fresh copy and lose its state.

One consequence is easy to miss. A patched vtable slot no longer holds the address the app's
symbol table reports, so hotswap records what each swap installed. Without that record the
second swap of a method looks up an address that is no longer in the slot, and the first swap's
code keeps running.

Measured on the example, one process, no restart:

```
baseline  free=7  virtual=4242
swap 1    free=11 virtual=22     16645ms   (first build after a reinstall)
swap 2    free=33 virtual=44      3105ms
```

## C++ on Android

The same edit takes one write instead of two and lands in about half a second.

A freshly compiled `.so` goes into the app's own data directory and is loaded there. Then a
4-byte branch is written over each changed function's entry:

```
b <the new function>
```

arm64's `b` reaches 128MB. The patch usually lands further away than that, so hotswap first
allocates a trampoline near the original and branches to it. The trampoline holds the absolute
jump:

```
ldr x16, #8
br  x16
.quad <the new function>
```

Three earlier shapes failed before this one. A 16-byte absolute jump written straight over the
entry does not fit a function that returns a constant, which is 8 bytes; five of eleven symbols
were refused. A bare 4-byte branch to the patch is out of range. Four bytes is the shortest
function arm64 emits, so with a trampoline in reach nothing is too small.

Because the branch sits at the original's entry rather than at its call sites, one write covers
every way a call arrives: a direct PC-relative call, a PLT entry, a vtable slot. iOS needs a
vtable scan because dynamic replacement cannot do this.

It also means a second swap needs no bookkeeping. The entry is overwritten again and the symbol
table still reports the address it always did, so the registry iOS needs has no counterpart
here.

The room for the branch is measured on the unstripped library the app was built from, never on
the patch. An edit that grows a function would otherwise report space the running code does not
have. The compile command comes out of `compile_commands.json`, so the defines, include paths
and flags are the ones the installed code was built with.

```
baseline  free=10 virtual=1
swap 1    free=555 virtual=777       519ms
swap 2    free=42  virtual=31337     455ms
```

A `.cpp` in a Nitro module is compiled into both apps, so one save swaps both:

```
  ✅ cpp/HotswapProbeImpl.cpp  481ms      (android, pid unchanged)
  ✅ cpp/HotswapProbeImpl.cpp  6740ms     (ios, pid unchanged)
```

Only the platforms actually listening get attempted, so working against one simulator does not
print a failure for a device that was never started.

## Why not build tools 37

d8 from build-tools 37 drops `ACC_PRIVATE` from the synthetic methods Kotlin generates for
lambdas. ART compares the incoming class against the installed one and refuses the mismatch
with `jvmtiError 71`. Versions 34 through 36 keep the flag.

hotswap reads `buildToolsVersion` from your build. Failing that it picks the newest version at
or below 36.

## Prior art

Hot reload for JVM code is not new, but nothing covered React Native's native modules.

|                                                                       | What it does                                          |
| --------------------------------------------------------------------- | ----------------------------------------------------- |
| [HotswapAgent](https://github.com/HotswapProjects/HotswapAgent)       | JVM desktop, through JPDA                             |
| [Compose Hot Reload](https://github.com/JetBrains/compose-hot-reload) | Compose on the JetBrains Runtime, desktop             |
| [Compose HotSwan](https://hotswan.dev)                                | Compose on Android; moved off JVMTI to an interpreter |
| [InjectionIII](https://github.com/johnno1962/InjectionIII)            | Swift and Objective-C, through dylib interposing      |

HotSwan's write-up on leaving JVMTI is worth reading, with one qualification: the ceiling they
hit is classic `RedefineClasses`. ART's structural extension clears it for the cases above.
