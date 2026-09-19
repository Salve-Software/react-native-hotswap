# Comments

**Do not write comments in code.** Not one line, not above a block, not to warn about a trap.
This has been asked for more times than it should have been.

That includes every form of it:

- `//` anywhere, at any indentation, however short
- paragraph blocks explaining a decision
- JSDoc on a method, a property, a constant, a variable or a barrel export
- section markers like `// MARK:` or `// ===`
- a comment naming a platform API so it can be found by search

## The one exception, and it is narrow

A single-line `/** ... */` directly above **an exported class, an exported type in `types/`, or
an exported function in `library/`**, saying what that thing is. One line. Nothing else gets
one, including the module-private helpers in the same file.

```ts
/** Derives the JNI class name a Kotlin file compiles into. */
export function resolveClassName(source: string, fileName: string): string {}
```

If it does not fit on one line, it was never a name — it was decision context.

## Where decision context goes

The commit message, and nowhere else. That is where someone reads it: once, while deciding
whether the decision still holds. A comment repeats it forever to people who did not ask.

`rules/history.md` is for a decision that was tried and rejected. `README.md` and `docs/` are
for what a consumer needs. A file is for code.

## The check

Both of these must print nothing:

```bash
grep -rn "^[ \t]*//" src android/src ios --include=*.ts --include=*.kt --include=*.mm --include=*.cpp --include=*.h | grep -v vendor
grep -rn "^[ \t]\+/\*\*" src android/src ios | grep -v __tests__
```

The first finds an inline comment. The second finds JSDoc that is indented, which means it is
sitting on a method or a private function rather than on an export.

`android/src/main/cpp/vendor/jvmti.h` is excluded: it comes from AOSP and its licence header
stays untouched.
