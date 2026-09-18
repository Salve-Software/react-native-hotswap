# Comments

**As lean as possible.** One line or nothing.

## JSDoc — allowed, short, and only in three places

One line. Says what **that** thing is, or why it exists.

| Place                           | Example                                                             |
| ------------------------------- | ------------------------------------------------------------------- |
| Above a class                   | `/** Attaches the JVMTI agent once, on a debuggable build only. */` |
| Above a type, in `types/`       | `/** What to compile, and where from. */`                           |
| Above a function, in `library/` | `/** Derives the JNI class name a Kotlin file compiles into. */`    |

**Nothing beyond that.** No JSDoc on a method, a property, a constant, a variable or a barrel
export. No paragraph blocks. If it does not fit on one line, what is left over is decision
context — it goes in the commit message or the README, not in the file.

The test: if the text stays true when pasted onto another thing of the same kind, it says
nothing. `"Returns the current state"` fits any method; `"A flat fold reserves nothing"` fits
this one.

A good name needs no JSDoc. `buildDex`, `watchKotlin` and `findGradle` have none, and are not
worse for it.

## Comments inside a method or function

**Would deleting this break someone?** If not, delete it. Four kinds get through:

| Kind                              | Example in this repository                                     |
| --------------------------------- | -------------------------------------------------------------- |
| Looks like a bug and is not       | asking ART for fewer capabilities than the agent needs         |
| Deliberate absence                | the old `.so` never being unloaded, only shadowed              |
| Invisible trap                    | `exists()` following a symlink, so a stale one reads as absent |
| Platform limit the contract hides | `attachJvmtiAgent` rejecting any path containing `=`           |

What does not get through: narrating the next block, repeating the function name, explaining
the pattern instead of the instance, marking sections with `// MARK:` or `// ===`.

## Comments that name a platform API

A native symbol **is written exactly as it is**, so it can be found by search.

```kotlin
// Debug.attachJvmtiAgent rejects paths containing '='.
```

## Exception

`TODO(sdk):` marking what depends on a platform piece that is not built yet. Today that is the
iOS side.

When in doubt, do not comment.
