# Code structure

## One function per file

`cli/src/library/` holds one exported function per file, named after it in kebab-case, plus
an `index.js` re-exporting. A helper that only one function uses stays module-private in that
same file.

```
cli/
├── bin/hotswap.js          ← the executable, and nothing but argument handling
└── src/
    ├── library/            ← one function per file
    │   ├── resolve-class-name.js
    │   ├── build-dex.js
    │   ├── send-redefinition.js
    │   ├── watch-kotlin.js
    │   ├── load-config.js
    │   └── start-watching.js
    └── types/              ← shared shapes, when there are any
```

There are no classes here yet. When one appears it follows the reference layout: its own
folder inside a category, `<kebab>.class.js`, with `library/`, `types/` and `constants/`
beside it.

## File names

| File    | Pattern            | Example                |
| ------- | ------------------ | ---------------------- |
| Library | `<kebab>.js`       | `library/build-dex.js` |
| Type    | `<kebab>.js`       | `types/swap-config.js` |
| Class   | `<kebab>.class.js` | — none yet             |
| Kotlin  | PascalCase         | `HotswapAgent.kt`      |
| C++     | lowercase          | `agent.cpp`            |

Native file names follow each language's convention, not this project's.

## Two parameters maximum

More than two and it takes one object. This is why `buildDex({ className, project, task,
classes })` is shaped the way it is rather than taking four positionals.

## JavaScript, not TypeScript

This **diverges** from the reference, deliberately and with a cost.

`cli/bin/hotswap.js` is a `bin` entry and `metro.cjs` is required by a consumer's Metro
config. Both must run with no build step, from a package that may be installed straight from
a git checkout. TypeScript would put `lib/` between the source and the entry point, and a
stale or missing build would break the tool at the exact moment someone is trying it for the
first time.

The cost is real: no compiler checking these files. It is paid for with tests on everything
pure. If the CLI grows past what tests cover comfortably, revisit it.

## Purity is what makes it testable

A function that reads a file cannot be unit tested without touching the disk. So the parsing
and the reading are separated:

```js
resolveClassName(source, fileName); // pure, tested
readClassName(file); // reads, then delegates
```

Apply the same split anywhere else it appears. **A function that is hard to test is badly
shaped, not badly tooled.**

## Imports

Relative, no alias. The tree is shallow enough that `./` and `../` cover everything.

## Language

**Everything is in English** — names, emitted strings, comments, test descriptions, and every
document under `.claude/`.

## What never gets edited

`android/src/main/cpp/vendor/jvmti.h` comes from AOSP and carries its own licence header.
Do not reformat it, do not strip the header, do not "fix" it.
