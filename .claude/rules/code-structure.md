# Code structure

## The shape

One facade at the root of `src/`, classes under `classes/`, and each class keeps its own
helpers beside it. Nothing is a loose pile of functions.

```
src/
├── hotswap.class.ts        ← the facade: swap, watch, check
├── index.ts                ← what the package exports
├── bin.ts                  ← the executable, and nothing but argument handling
├── classes/
│   ├── agent/              ← the socket to the half that lives in the app
│   ├── configuration/      ← works out the project's layout
│   ├── swapper/
│   │   ├── kotlin-swapper/
│   │   ├── native-swapper/ ← C++ on Android
│   │   └── ios-swapper/    ← Swift and C++ on the simulator
│   └── watcher/
├── library/                ← helpers more than one class needs
├── types/
└── constants/
```

Every folder carries an `index.ts` that re-exports it, and a class folder holds
`<kebab>.class.ts` with `library/`, `types/` and `constants/` beside it as needed.

## The facade is the entry point

`bin.ts` and `metro.cjs` both construct `Hotswap` and call it. Neither reaches past it into a
swapper or a helper, which is what keeps `index.ts` from growing into a list of every
function in the package.

## One function per file

A `library/` folder holds one exported function per file, named after it in kebab-case, plus
an `index.ts` re-exporting. A helper only its neighbour uses stays module-private in that
same file.

A helper belongs to the class that needs it. It only moves up to `src/library/` when a second
class needs it too — that is what `findUnder`, `forwardPort` and `serialize` earned.

## File names

| File    | Pattern            | Example                        |
| ------- | ------------------ | ------------------------------ |
| Class   | `<kebab>.class.ts` | `kotlin-swapper.class.ts`      |
| Library | `<kebab>.ts`       | `library/build-dex.ts`         |
| Type    | `<kebab>.ts`       | `types/swap-config.ts`         |
| Kotlin  | PascalCase         | `HotswapAgent.kt`              |
| C++     | lowercase          | `agent.cpp`, `native_swap.cpp` |

Native file names follow each language's convention, not this project's.

## Two parameters maximum

More than two and it takes an object. `buildDex({ className, project, task, classes, minApi,
buildTools })` is shaped that way for this reason, and `max-params` enforces it.

## TypeScript, compiled to `lib/`

`tsc` only — no bundler and no babel. The package ships `lib/`, and `prepare` builds it, so an
install from the registry or from git arrives compiled.

The one trap: a checkout used straight from disk has no `lib/` until `bun run build` runs.
`metro.cjs` checks for it and says so, because a missing directory otherwise reads as a broken
tool rather than a build that has not happened yet.

`metro.cjs` stays CommonJS and stays hand-written at the root — Metro `require`s it from the
consumer's config, so it cannot be an ES module and cannot live behind the build. It holds no
logic beyond finding the module root and handing off.

## Purity is what makes it testable

A function that reads a file cannot be unit tested without touching the disk, so the parsing
and the reading are separated:

```ts
resolveClassName(source, fileName); // pure, tested
readClassName(file); // reads, then delegates
```

**A function that is hard to test is badly shaped, not badly tooled.**

## Imports

Relative, with the `.js` extension the compiler expects under `nodenext`. No path aliases.

## Language

**Everything is in English** — names, emitted strings, comments, test descriptions, and every
document under `.claude/`.

## What never gets edited

`android/src/main/cpp/vendor/jvmti.h` comes from AOSP and carries its own licence header.
Do not reformat it, do not strip the header, do not "fix" it.
