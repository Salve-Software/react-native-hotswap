# Expo

hotswap works on an Expo project, with one hard requirement and one plugin.

## It needs a development build

Expo Go is a prebuilt binary. You cannot add native code to it, and hotswap ships a JVMTI agent
inside its own AAR, so there is nothing to attach. Use a development build:

```bash
npx expo install expo-dev-client
npx expo run:android
```

No plugin, no config and no workaround changes this.

## Setup

```bash
npx expo install @salve-software/react-native-hotswap
```

```json
// app.json
{
  "expo": {
    "plugins": ["@salve-software/react-native-hotswap"]
  }
}
```

Then the Metro wrapper, which is yours and not generated:

```js
// metro.config.js
const { getDefaultConfig } = require('expo/metro-config');
const { withHotswap } = require('@salve-software/react-native-hotswap/metro.cjs');

module.exports = withHotswap(getDefaultConfig(__dirname));
```

Run `npx expo prebuild` after adding the plugin.

## What the plugin edits

Expo regenerates `android/` and `ios/` on every prebuild, so hand edits do not survive. The
plugin puts the same three lines back each time:

| File                 | Line                                                          |
| -------------------- | ------------------------------------------------------------- |
| `MainApplication.kt` | wraps the package list in `HotswapPackages.of(...)`           |
| `AppDelegate.swift`  | adds `getModuleClassFromName:` to your `ReactNativeDelegate`  |
| `Podfile`            | calls `hotswap_post_install(installer)` inside `post_install` |

Only generations need any of it. Patching works without the plugin, since the agent attaches
from a `ContentProvider` in the AAR and autolinking is enough to get the AAR in.

## Why Expo gets a different Android hook

On bare React Native, `HotswapReactHost.create` builds the `ReactHost` itself. On Expo that
would be wrong: `ExpoReactHostFactory` sets up the dev client, resolves the bundle through
`.expo/.virtual-metro-entry`, and runs Expo's host handlers. Replacing it would take all of
that out.

So Expo keeps its own host. `ExpoReactHostFactory` captures the package list once:

```kotlin
override val reactPackages: List<ReactPackage>
  get() = packageList
```

`HotswapPackages.of` hands it a list that hotswap keeps a reference to. Publishing a generation
rewrites that list in place before asking the host to reload, and React Native reads the new
contents when it builds the next instance. Expo already reuses package instances across
reloads, so this matches what it does anyway.

## Limits on Expo

Everything in [limits.md](limits.md) still applies, plus one thing that is not Expo's fault:

**Your app's own Swift and C++ are not swapped.** hotswap compiles those through a pod, and it
finds the pod by looking for a `.podspec` in the project root. An app does not have one. This
is the same on a bare React Native app. Kotlin in your `android/` swaps either way, and a
module you depend on swaps in every language it uses.

Run `npx hotswap --check` to see what it worked out about your project.
