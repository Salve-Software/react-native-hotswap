# Limits

Everything here was measured on `example/`, not read off a manual. There are two mechanisms:
patching rewrites code that is already loaded, and a generation rebuilds the module and loads
it beside what is running. Patching runs first, and the runtime decides when it is not enough.

## What a patch handles

ART's structural redefinition, on Android 11 and up, goes past method bodies:

| Change                          | Patched |
| ------------------------------- | ------- |
| Method body                     | ✅      |
| New method on an existing class | ✅      |
| New field on an existing class  | ✅      |
| New top-level function          | ✅      |

On iOS a patch replaces method bodies only. Swift's dynamic replacement needs something that
was already there when the app launched, so a new method has nothing to attach to.

## What needs a generation

| Change                     | Why a patch cannot do it                          |
| -------------------------- | ------------------------------------------------- |
| A class in a new file      | it was never in the apk, so nothing has it loaded |
| Removing a method or field | ART refuses with `jvmtiError 67`                  |
| A new method, on iOS       | dynamic replacement has nothing to replace        |
| A changed hierarchy        | the shape of a loaded class is fixed              |

You do not ask for this. The refusal comes back from the device and hotswap republishes:

```
  ↻ probe/android/.../BornAtRuntime.kt  class not loaded yet
  ♻️  probe/android/.../BornAtRuntime.kt  reloaded from a new generation  942ms
```

Two things a generation cannot reach:

- **`MainActivity` and `MainApplication`.** A React reload rebuilds the React instance, not the
  Activity. Those get patched, which keeps the app where it was.
- **A class with native methods.** `System.loadLibrary` binds a library to the class loader
  that called it, so a second loader asking for the same `.so` brings the app down.

## What neither handles

- **Objective-C and Objective-C++.** Compiling a `.mm` into the patch would define its classes
  a second time and the runtime would pick one of them. `.m` and `.mm` are left alone.
- **Anything already inlined.** If the compiler copied a body into its callers, none of this
  reaches it. Debug builds inline little, so it rarely comes up.
- **A function pointer on the heap.** Vtables get patched because they sit in the image's data
  sections, which is what gets scanned. A `std::function` built at runtime, or a callback table
  allocated on the heap, still holds the old address.
- **Static initialisers running twice.** A swapped translation unit is loaded, so whatever it
  constructs at load time gets constructed again. Keep one-time setup out of the file you are
  editing.
- **A Swift top-level function.** The replacement is emitted as an extension, so it needs a
  type. Methods on a `class`, `struct`, `enum`, `actor` or `extension` all swap.
- **A file your native build does not compile.** Flags come from the project's own
  `compile_commands.json`, so a file no target lists has nothing to derive them from.
- **A C++ function the branch cannot reach.** On Android the redirect is a 4-byte branch, which
  reaches 128MB. When the patch lands further away hotswap allocates a trampoline near the
  original; if no page fits, it says so and skips the function.
- **iOS devices.** Simulator only.
- **Release builds.** The agent attaches only on a debuggable build, and ART refuses anyway.

## The Nitro spec guard

Changing a `.nitro.ts` spec means nitrogen has to regenerate the C++ bridge, so the ABI moved.
Swapping Kotlin against the old bridge would give you an app that half works, so hotswap
refuses:

```
  ⛔ ProbeValues.kt  src/specs/probe.nitro.ts changed; run codegen and rebuild
```
