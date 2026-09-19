## [0.2.0](https://github.com/Salve-Software/react-native-hotswap/compare/v0.1.0...v0.2.0) (2026-09-19)

### ✨ Features

* **check:** ask the agent which app it is ([01cdc6f](https://github.com/Salve-Software/react-native-hotswap/commit/01cdc6f8baca3fdd3a5a196b5e4550e0c856f09f))
* **ios:** let a patch carry a file the running app never had ([8188347](https://github.com/Salve-Software/react-native-hotswap/commit/8188347b88408d1452c66f52cb6d5e4314040d0e))
* **ios:** swap a new Swift file through whatever calls it ([0691d8b](https://github.com/Salve-Software/react-native-hotswap/commit/0691d8bc6c7183f28a145aec8fa4b434e5526585))

### 🐛 Bug Fixes

* **cli:** print the compiler's error, not its command line ([c72b3f6](https://github.com/Salve-Software/react-native-hotswap/commit/c72b3f6f137fc9b09148f8653466b7b7645c9dcf))
* **example:** apply the React Native plugin to the probe module ([7cc68b6](https://github.com/Salve-Software/react-native-hotswap/commit/7cc68b66640da0ad7193c036d10422d8d6e6e865))
* **example:** hold @babel/runtime at 7, which Metro can resolve ([#14](https://github.com/Salve-Software/react-native-hotswap/issues/14)) ([c78d0b2](https://github.com/Salve-Software/react-native-hotswap/commit/c78d0b29f68c4247404d853f0e63afa88f08b7f7))
* **generation:** read native bindings from the compiled classes ([4f76f4f](https://github.com/Salve-Software/react-native-hotswap/commit/4f76f4f983d5a2648a3bd293fe9d13f2a6500fd8))
* **generation:** recognise the ReactPackage base classes ([1a138f2](https://github.com/Salve-Software/react-native-hotswap/commit/1a138f282bedfdbe810ebc5de73aeaf666e8803d))
* **generation:** refuse a generation that would reach nothing ([2d7871f](https://github.com/Salve-Software/react-native-hotswap/commit/2d7871f49c38c31335bddf3e8e4a42ea05164291))
* **ios:** capture the swiftc the simulator's architecture was built with ([#16](https://github.com/Salve-Software/react-native-hotswap/issues/16)) ([4ac58fa](https://github.com/Salve-Software/react-native-hotswap/commit/4ac58fabbb441f2a9658f9bf6e015c8246ce2a91))

### 💨 Performance Improvements

* **ios:** replay the captured clang for a C++ swap ([ea79518](https://github.com/Salve-Software/react-native-hotswap/commit/ea795189bd99020782e3a0b798973c2900dfa8a7))
* **ios:** replay the captured compile instead of running xcodebuild ([53211ae](https://github.com/Salve-Software/react-native-hotswap/commit/53211aeafd461c323ee6247cc3b6521a0ca3c689))
* warm both compilers when the watcher starts ([0ea53ba](https://github.com/Salve-Software/react-native-hotswap/commit/0ea53ba94275d88558059e1d0fb8c91d39e056d2))

### 🧹 Cleanup

* cut every comment back to one line ([f871d63](https://github.com/Salve-Software/react-native-hotswap/commit/f871d630239fc3dfd16e97bccb4b9dcc0c9c3355))
* remove every comment from the code ([d3443f5](https://github.com/Salve-Software/react-native-hotswap/commit/d3443f5cfbea5fb8ced1f8831e94ec1784f426c7))

### 📦 Build

* **deps-dev:** bump @types/node from 22.20.3 to 26.6.1 ([#12](https://github.com/Salve-Software/react-native-hotswap/issues/12)) ([49517d1](https://github.com/Salve-Software/react-native-hotswap/commit/49517d13e435e017cbd734a6dbe395ae1eedf7bf))
* **deps-dev:** bump react-native from 0.76.5 to 0.87.1 ([#11](https://github.com/Salve-Software/react-native-hotswap/issues/11)) ([1bf5a6a](https://github.com/Salve-Software/react-native-hotswap/commit/1bf5a6acccb006b6b866e58edb1122d42c07bacb))
* **deps-dev:** bump the babel group across 1 directory with 3 updates ([#9](https://github.com/Salve-Software/react-native-hotswap/issues/9)) ([4d2712e](https://github.com/Salve-Software/react-native-hotswap/commit/4d2712e910dcf957f603bb2e87d1efdfd02de6ec))
* **deps-dev:** bump the react-native-cli group across 1 directory with 3 updates ([#8](https://github.com/Salve-Software/react-native-hotswap/issues/8)) ([78a0875](https://github.com/Salve-Software/react-native-hotswap/commit/78a0875139f618201f0bd9f9d037280c866e4070))
* **deps:** bump actions/cache from 4 to 6 ([#2](https://github.com/Salve-Software/react-native-hotswap/issues/2)) ([939b7b4](https://github.com/Salve-Software/react-native-hotswap/commit/939b7b436167f5cdb3c0bdd489af3e23ab8ca664))
* **deps:** bump actions/checkout from 4 to 7 ([#5](https://github.com/Salve-Software/react-native-hotswap/issues/5)) ([62ac138](https://github.com/Salve-Software/react-native-hotswap/commit/62ac138c5a96df881f8b52ee53c11a16d67b6fd0))
* **deps:** bump actions/setup-java from 5 to 6 ([#7](https://github.com/Salve-Software/react-native-hotswap/issues/7)) ([79c6b1f](https://github.com/Salve-Software/react-native-hotswap/commit/79c6b1fe7a81f87f18648cf3305f951b77d3acfb))
* **deps:** bump actions/setup-node from 4 to 7 ([#6](https://github.com/Salve-Software/react-native-hotswap/issues/6)) ([3309213](https://github.com/Salve-Software/react-native-hotswap/commit/33092135cd83b1ea0dd3c222db54173b5897a040))
* **deps:** bump concurrent-ruby from 1.3.3 to 1.3.8 in /example ([#4](https://github.com/Salve-Software/react-native-hotswap/issues/4)) ([e69b949](https://github.com/Salve-Software/react-native-hotswap/commit/e69b9492e1c5ee3ec7e60788ff807566f474cf8c))
* **deps:** bump xcodeproj from 1.25.1 to 1.28.1 in /example ([#1](https://github.com/Salve-Software/react-native-hotswap/issues/1)) ([1b9c6dc](https://github.com/Salve-Software/react-native-hotswap/commit/1b9c6dc404699a65a4ea5daed43b6ce44544c527))

### 📚 Documentation

* record the new timings and where they came from ([dc38c55](https://github.com/Salve-Software/react-native-hotswap/commit/dc38c556d6bdc94d48efa5cb636a632ca0c19661))

### 🧪 Tests

* **e2e:** prove a swap reaches a running app, on both platforms ([#15](https://github.com/Salve-Software/react-native-hotswap/issues/15)) ([86ea8ad](https://github.com/Salve-Software/react-native-hotswap/commit/86ea8ad70b6c3032d61ba7c0b1d10e23191a71ed))

### ⚙️ Continuous Integration

* build iOS against any simulator, not a named one ([e59e421](https://github.com/Salve-Software/react-native-hotswap/commit/e59e421615c516e23b90d8f57a41e58c9eda65d2))

## [0.1.0](https://github.com/Salve-Software/react-native-hotswap/compare/v0.0.0...v0.1.0) (2026-09-18)

### ✨ Features

* **android:** build a React instance from a generation ([703cc2c](https://github.com/Salve-Software/react-native-hotswap/commit/703cc2c7730f7fbb1092a4530e7cfb78915cb6cb))
* **android:** load the agent straight out of the apk ([733946f](https://github.com/Salve-Software/react-native-hotswap/commit/733946fad2e24ea2833af5d44f78f0360b7e4166))
* **android:** redirect C++ functions to a freshly loaded library ([1992495](https://github.com/Salve-Software/react-native-hotswap/commit/19924950e809201685deb4345cc6044d68c7f026))
* **android:** reload a host this library did not create ([6b2d921](https://github.com/Salve-Software/react-native-hotswap/commit/6b2d9216c1036aeb0a1fc9f21141042f1079fc50))
* **cli:** add a setup check ([e1b3a09](https://github.com/Salve-Software/react-native-hotswap/commit/e1b3a09f824f8b4a811143b444a30b03f003e7ed))
* **cli:** add the hotswap command ([316361c](https://github.com/Salve-Software/react-native-hotswap/commit/316361c785c8896f534aa05cd3f35efac69a01c5))
* **cli:** build an iOS generation from the module's own compile ([43414eb](https://github.com/Salve-Software/react-native-hotswap/commit/43414eb8188a3e8b23192a7dce59d4633414608a))
* **cli:** check the iOS loader and the patch files ([16245f0](https://github.com/Salve-Software/react-native-hotswap/commit/16245f0f78575b4b859ba7a82c5cd11cd827daa8))
* **cli:** compile a changed C++ file for Android and ship it ([d2feeea](https://github.com/Salve-Software/react-native-hotswap/commit/d2feeeaf5c03fd210467b4558fef732dc7815ba3))
* **cli:** compile a changed C++ file into the swap dylib ([fb1b344](https://github.com/Salve-Software/react-native-hotswap/commit/fb1b3444c641113f0d4a5794b021847660b99a67))
* **cli:** configure itself for an app, not only a library ([6fe0516](https://github.com/Salve-Software/react-native-hotswap/commit/6fe0516ba6148605cbfbca784d91bb1ba006e59b))
* **cli:** explain jvmti errors instead of printing numbers ([cf43e16](https://github.com/Salve-Software/react-native-hotswap/commit/cf43e16bbacb06c190d36a229be03cbccff08812))
* **cli:** read minSdk and build-tools from the app's own build ([c3e5fea](https://github.com/Salve-Software/react-native-hotswap/commit/c3e5fea54a85ca925a1e7851e182da10a6eb11d2))
* **cli:** refuse a swap when the spec is newer than codegen ([be866dd](https://github.com/Salve-Software/react-native-hotswap/commit/be866dd68dac1ad496b7c8ee02f0ad7598b3f71d))
* **cli:** say when iOS swapping cannot work here ([f383d0c](https://github.com/Salve-Software/react-native-hotswap/commit/f383d0cf1dd6b55021237a38ee7ee1e94ba7ddd3))
* **cli:** take the iOS build location from Xcode ([bdce174](https://github.com/Salve-Software/react-native-hotswap/commit/bdce17434968abae1c6109f5b473a959fdcb2048))
* **cli:** watch Kotlin sources and swap on save ([9929218](https://github.com/Salve-Software/react-native-hotswap/commit/9929218953ac7372be239edbc42fc44a84552ef6))
* **example:** a real TurboModule, and the iOS signal that was wrong ([ed19316](https://github.com/Salve-Software/react-native-hotswap/commit/ed19316ce2a77c573ad125434236b64cfddb64fb))
* **example:** an app of our own, with a probe in every language ([cafe488](https://github.com/Salve-Software/react-native-hotswap/commit/cafe48830e68dcd84ab2575ba2b1d1bcc03f3d01))
* **expo:** add the config plugin ([4709de2](https://github.com/Salve-Software/react-native-hotswap/commit/4709de2e3c180d428b209493acf80c2638f3cfa0))
* **ios:** add the loader, the rebinder and the swift path ([1a3060e](https://github.com/Salve-Software/react-native-hotswap/commit/1a3060e81765dc6824d53cc41bf67f5db6188e4b))
* **ios:** build through xcode, and report a load that replaced nothing ([dabb48f](https://github.com/Salve-Software/react-native-hotswap/commit/dabb48f3bcac43abe827ab25976b6a3da866e9c2))
* **ios:** create the patch file, and leave it empty between saves ([b3a0c11](https://github.com/Salve-Software/react-native-hotswap/commit/b3a0c119f466989ea94760cac07a3b592bfa96c3))
* **ios:** generations, and two bugs the example found ([3621cfa](https://github.com/Salve-Software/react-native-hotswap/commit/3621cfa9367ef00ac3e75a3d826052a8f6877398))
* **ios:** replace live swift through dynamic replacement ([0480cf4](https://github.com/Salve-Software/react-native-hotswap/commit/0480cf440d8924b1699f7f3514b7cb091789b9e8))
* **ios:** swap C++ by patching stored function pointers ([bb57f71](https://github.com/Salve-Software/react-native-hotswap/commit/bb57f71b38314c0bfee7fe322cf30a0f3f7ddca2))
* **ios:** the delegate hook a generation is reached through ([ee8df41](https://github.com/Salve-Software/react-native-hotswap/commit/ee8df412dc5530bd1dc4652fe3e94d3a1b1e8b81))
* **metro:** run the watcher inside Metro ([38cd798](https://github.com/Salve-Software/react-native-hotswap/commit/38cd798ed8c6b32beccf2f2ae4b1e98b570de23b))
* **notice:** give the banner its own look and wording ([3911ad4](https://github.com/Salve-Software/react-native-hotswap/commit/3911ad4bb59cc05865ffcda2b19f76af1bc48661))
* **notice:** show a banner on a native swap ([f32ef9d](https://github.com/Salve-Software/react-native-hotswap/commit/f32ef9d371fb39134e9d3c9a449f668f2ca9acfc))
* ship a generation over the socket, and let ART choose the path ([549c0ee](https://github.com/Salve-Software/react-native-hotswap/commit/549c0ee9d1f04c1135ff94f384ad26903c271985))
* swap what a header reaches, instead of ignoring the save ([5439ed9](https://github.com/Salve-Software/react-native-hotswap/commit/5439ed9268854d8faa64b57f52e1c0da861e3aa6))
* watch more than one root, and an example that has two ([45879b8](https://github.com/Salve-Software/react-native-hotswap/commit/45879b83970a156b8d66a7b8c0de64751e03adce))

### 🐛 Bug Fixes

* a deleted file is an edit, not a crash ([b49cd0e](https://github.com/Salve-Software/react-native-hotswap/commit/b49cd0e669ca5e2846ee508201b4104e2b86cbc2))
* **android:** make the agent actually attach ([e721e70](https://github.com/Salve-Software/react-native-hotswap/commit/e721e70fcaa093acaeb366a9db31af398dc55609))
* **android:** redirect a function of any size, through a trampoline ([541d75a](https://github.com/Salve-Software/react-native-hotswap/commit/541d75a6996d2b604118553aefae201a0b014878))
* **android:** swap Nitro implementation classes ([fb88111](https://github.com/Salve-Software/react-native-hotswap/commit/fb8811186c218a91a2ea5aabcd1596c05574fd56))
* **cli:** count only braces that are really code ([4677570](https://github.com/Salve-Software/react-native-hotswap/commit/4677570ace42fa25a71e1b16af36850962d6452c))
* **cli:** derive the gradle project name from the package name ([a2a8274](https://github.com/Salve-Software/react-native-hotswap/commit/a2a8274be5b87a6d1bacdffd931be8e1b4f0ab9f))
* **cli:** find a source the build recorded through a symlink ([8b6fff5](https://github.com/Salve-Software/react-native-hotswap/commit/8b6fff5c0cc000d26a7f1c7d1fa3394729ed6daa))
* **cli:** recognise a C++ path as a file to swap ([d7acb1c](https://github.com/Salve-Software/react-native-hotswap/commit/d7acb1cb87a0efd5a6d8bc6b7bd236816fc81787))
* **cli:** stop the watcher reacting to the file it writes ([cddb769](https://github.com/Salve-Software/react-native-hotswap/commit/cddb76967817acb5e339b52e8819e5415535213f))
* **config:** watch android/src/main/cpp ([29dfe4c](https://github.com/Salve-Software/react-native-hotswap/commit/29dfe4c7172091edfcdc3c6faa78e572ad83f8bc))
* give both ends of the socket a way out ([bd0bac0](https://github.com/Salve-Software/react-native-hotswap/commit/bd0bac087a33396cdab87408fbf1b33126f49dc6))
* **ios:** apply -interposable to the app target, not just the pods ([69b8e3c](https://github.com/Salve-Software/react-native-hotswap/commit/69b8e3c658ef9ee6f11d4c76fe78bf3657c182db))
* **ios:** find the loaded image, and read its section names correctly ([7548101](https://github.com/Salve-Software/react-native-hotswap/commit/75481014086189de2000b3bb33dc3fa1e15f742a))
* **ios:** keep patching the same C++ method on a second swap ([bba688a](https://github.com/Salve-Software/react-native-hotswap/commit/bba688a54e6398216f3789e57381038f399b3faf))
* **ios:** link each swap under a name of its own ([6d8a4e6](https://github.com/Salve-Software/react-native-hotswap/commit/6d8a4e6152c9b06f7649c88a8d0c65ac15345baa))
* **ios:** only rebind symbols the new image actually defines ([f96a3cf](https://github.com/Salve-Software/react-native-hotswap/commit/f96a3cf98b827ad747f349f2787cf3e24f186e1c))
* **ios:** replace every Swift type, and scope methods to the one declaring them ([69fedb3](https://github.com/Salve-Software/react-native-hotswap/commit/69fedb3a681c0cbaed2800e3d571ca6f18454126))
* **ios:** stop the podfile hook appending its flags on every install ([5ead4bb](https://github.com/Salve-Software/react-native-hotswap/commit/5ead4bbd76301ed586b19f30dd89c681549f7a63))
* let autolinking find the package ([954c244](https://github.com/Salve-Software/react-native-hotswap/commit/954c244e2e7dcca9a9efe25b96e5e14cd689487e))
* **metro:** start on a library that has no android sources ([1c825fe](https://github.com/Salve-Software/react-native-hotswap/commit/1c825fea6f6d7d67a6dd943a7eec2b480d04882c))

### 💨 Performance Improvements

* **android:** snapshot loaded classes once per batch ([531ba09](https://github.com/Salve-Software/react-native-hotswap/commit/531ba094ab81704213c742459316a44117512001))

### 🔄 Code Refactors

* **android:** let the names carry what the comments were carrying ([bf140d4](https://github.com/Salve-Software/react-native-hotswap/commit/bf140d4c7d1e9e0413ff4fd8507228babe7a5564))
* **cli:** extract swapFile from the watcher ([f5aaae7](https://github.com/Salve-Software/react-native-hotswap/commit/f5aaae7e290a3069bcd245488dc5084a624ea09c))
* **cli:** extract the socket and the two helpers around it ([47e4412](https://github.com/Salve-Software/react-native-hotswap/commit/47e44125cc07bccefb139718a7dafe6eda014139))
* **cli:** separate pure parsing from file reading ([2dffea8](https://github.com/Salve-Software/react-native-hotswap/commit/2dffea8213d97621e75161345a0d283f18101e79))
* constants to constants/, type imports to the top ([23a133e](https://github.com/Salve-Software/react-native-hotswap/commit/23a133e1edf064a0c3fcb442817703d07691a6f5))
* cut every comment that only repeated its name ([5d5e7d1](https://github.com/Salve-Software/react-native-hotswap/commit/5d5e7d19cfcd23226af8ce9f59a90951e3410be5))
* cut the comments back to one line each ([b6b7506](https://github.com/Salve-Software/react-native-hotswap/commit/b6b750638e311c9fd254f83c03463e9b539f608c))
* cut the rest, down to what cannot be inferred ([e081e54](https://github.com/Salve-Software/react-native-hotswap/commit/e081e54869165827468b81cf9ceba633a2df6a07))
* **ios:** extract the mach-o primitives ([82898f8](https://github.com/Salve-Software/react-native-hotswap/commit/82898f889f8f88bf04919b78ec4eda732b688c63))
* move the CLI into src/, in TypeScript, behind a facade ([e6d3a5e](https://github.com/Salve-Software/react-native-hotswap/commit/e6d3a5e9a3dee40ed4ae28d36af814c0a6dd1449))

### 🧹 Cleanup

* drop comments that break the one-line rule ([a2ec59e](https://github.com/Salve-Software/react-native-hotswap/commit/a2ec59ecba5b54a8d0bda86910f0ab86778874db))

### 📦 Build

* add the eslint config the scripts assumed ([0040506](https://github.com/Salve-Software/react-native-hotswap/commit/0040506c272c0dd0066be4cd7957943724c19f39))
* add vitest, prettier and lint tooling ([b77df1f](https://github.com/Salve-Software/react-native-hotswap/commit/b77df1f11dfa0d9e3e08ffed26338a8997969c75))
* **npm:** publish under the salve-software scope ([22b5dea](https://github.com/Salve-Software/react-native-hotswap/commit/22b5deae90a0e6f86b7eb0bc8f97e4bb6f07b7ba))
* publish only what a consumer needs ([138dd74](https://github.com/Salve-Software/react-native-hotswap/commit/138dd74e9730853f6dfccddf6491f39329575130))
* **release:** pin the changelog preset to the writer's major ([96cf2f3](https://github.com/Salve-Software/react-native-hotswap/commit/96cf2f3607e619d15ccf2d6a277c9fc13e16200c))
* stop shipping our own gradle wrapper ([bce4d89](https://github.com/Salve-Software/react-native-hotswap/commit/bce4d8932a22b370407b80fbaca26d51a3957a61))

### 📚 Documentation

* a class in a new file does not load, it throws ([72e5c99](https://github.com/Salve-Software/react-native-hotswap/commit/72e5c994fd4d9a3126092cfd183b09d0346bea87))
* add the README ([f35670b](https://github.com/Salve-Software/react-native-hotswap/commit/f35670b708dcd9d7251eaa5b4815ba69ccef19b6))
* C++ swaps on Android too, and correct the W^X claim ([bbe874d](https://github.com/Salve-Software/react-native-hotswap/commit/bbe874d9bc23f1157ef38bacd367cc9de361a117))
* C++ swaps on the iOS simulator ([e4d12a6](https://github.com/Salve-Software/react-native-hotswap/commit/e4d12a628d95e040a478f54153714a7b40a95ecd))
* **claude:** add architecture rule ([c5a647d](https://github.com/Salve-Software/react-native-hotswap/commit/c5a647d114716e4d855ed6084dfacb50c39f9eba))
* **claude:** add code structure rule ([817e28f](https://github.com/Salve-Software/react-native-hotswap/commit/817e28fcaa8614f0796b548d2185ba347bc49583))
* **claude:** add comments rule ([ed45241](https://github.com/Salve-Software/react-native-hotswap/commit/ed452413de45842feadab8447e55d7173dd48115))
* **claude:** add project overview ([1283a94](https://github.com/Salve-Software/react-native-hotswap/commit/1283a94f57008a47caa1e6fdcb00628ac68f0d17))
* **claude:** add testing rule ([392a45e](https://github.com/Salve-Software/react-native-hotswap/commit/392a45e4f0f38a4acfa36da2de6ad7b08e3ec65d))
* **claude:** add tooling rule ([d4e5a2b](https://github.com/Salve-Software/react-native-hotswap/commit/d4e5a2b170a8ada61dab6ea47ce6536e06f68175))
* **claude:** describe the structure that exists now ([6f8799b](https://github.com/Salve-Software/react-native-hotswap/commit/6f8799b938d46e85c3db95c580847d2e13022ad5))
* **claude:** record that structural redefinition lifts the usual ceiling ([3024ac1](https://github.com/Salve-Software/react-native-hotswap/commit/3024ac15d8ebaf7a84dad164ff0fe84cc1715307))
* **claude:** record the Android C++ mechanism and the wrong claim ([62201ab](https://github.com/Salve-Software/react-native-hotswap/commit/62201ab64141bc8a4961036b946ad1aefd122a80))
* **claude:** record the C++ mechanism and how to check it ([783a6a9](https://github.com/Salve-Software/react-native-hotswap/commit/783a6a92fb93653ffb8b933c7e886519fe030691))
* **claude:** the rules describe both mechanisms ([a4e6b94](https://github.com/Salve-Software/react-native-hotswap/commit/a4e6b945554625a7b098150cdb9090e01c3fa1b5))
* **claude:** write down the two rules I kept breaking ([c5003e5](https://github.com/Salve-Software/react-native-hotswap/commit/c5003e502de97bc54aca2629069025e8195b41a0))
* cut the README to 129 lines and move the rest out ([9d9eaa7](https://github.com/Salve-Software/react-native-hotswap/commit/9d9eaa7fd39c87842c3d51b0c32b563114f3adbc))
* iOS generations compile, measured on the real pod ([d412208](https://github.com/Salve-Software/react-native-hotswap/commit/d412208048e4cda19fdc7269137b93570008d88e))
* iOS generations, measured ([6594f40](https://github.com/Salve-Software/react-native-hotswap/commit/6594f40495b9b13d7bea946014a864de0ca147f3))
* point the banner at an absolute url ([d9c10e8](https://github.com/Salve-Software/react-native-hotswap/commit/d9c10e8710cc77edd173a0da9e05067e6d479309))
* put the banner at the top of the readme ([86aa465](https://github.com/Salve-Software/react-native-hotswap/commit/86aa4656ba812578ead3733b1eca63b4d7df9e8e))
* record what the banner cost to get right ([ba225e3](https://github.com/Salve-Software/react-native-hotswap/commit/ba225e3f298feae16d0108cb318971bae768b64b))
* rule C++ out of scope, with the reasoning ([b9a7590](https://github.com/Salve-Software/react-native-hotswap/commit/b9a759010b7e11f3b61cd27f238c48ca22c9f147))
* state the reach of pointer patching accurately ([f7e0fea](https://github.com/Salve-Software/react-native-hotswap/commit/f7e0feab080e06e2285abf88dd2f22d8e7b498fe))
* the generation plan, and what verified it ([6c8a4cc](https://github.com/Salve-Software/react-native-hotswap/commit/6c8a4ccd7183ed810dbda6439e4808aee72e6065))
* the loader is proven, with the numbers ([10f46e7](https://github.com/Salve-Software/react-native-hotswap/commit/10f46e7e7efe553a5f7139ce1f5ffbd6c4bba6bd))
* the README covers the Swift path ([a1f8658](https://github.com/Salve-Software/react-native-hotswap/commit/a1f865848623f75a495d73009b32f2106aaf9c90))
* what the iOS delegate hook reaches, and what it does not ([f07a92b](https://github.com/Salve-Software/react-native-hotswap/commit/f07a92bc63a12d92dee583d8b4b55b593d90702f))
* write down how the pipeline works ([f7b6bc1](https://github.com/Salve-Software/react-native-hotswap/commit/f7b6bc1de5be2612251840b2a0821ab9c7ef33d0))
* write down what Expo needs ([2c1153f](https://github.com/Salve-Software/react-native-hotswap/commit/2c1153f64287725b90c45968892bbb649a3495f6))
* write down what the next agent needs, not what I remember ([c25a2d1](https://github.com/Salve-Software/react-native-hotswap/commit/c25a2d18197f2ba10b11086de51753e6918139fb))

### 🛠️ Other changes

* **example:** probe back to its baseline value ([e54b334](https://github.com/Salve-Software/react-native-hotswap/commit/e54b334923b2c34ce0452d99388eab4bedc51b1a))
* ignore the example's build output ([896b741](https://github.com/Salve-Software/react-native-hotswap/commit/896b7411727d50e09883195dcf03f04387c51419))
* rename to react-native-hotswap ([1336190](https://github.com/Salve-Software/react-native-hotswap/commit/133619051b988f3851ace0d895f16c32bd0f196e))

### 🧪 Tests

* **cli:** cover command splitting and symbol parsing ([ea4ec3f](https://github.com/Salve-Software/react-native-hotswap/commit/ea4ec3f9ae78531e1b84e25d8184baf276788ae1))
* **cli:** cover config path resolution ([1242ab9](https://github.com/Salve-Software/react-native-hotswap/commit/1242ab989aeb4301d1e4ffcb3090c351eafde29d))
* **cli:** cover resolveClassName ([9adabd4](https://github.com/Salve-Software/react-native-hotswap/commit/9adabd4d5ffcd8e2c654e144fc8398e3ad31349f))
* **cli:** cover the dispatch predicate and pod name lookup ([94f6ca5](https://github.com/Salve-Software/react-native-hotswap/commit/94f6ca574fd98b1d13468f26ef815e27cc3e1c74))

### ⚙️ Continuous Integration

* build the example on both platforms ([b53bdbb](https://github.com/Salve-Software/react-native-hotswap/commit/b53bdbb45ddf09ed3cd21af4a9fb8ec7ea622507))
* line verify up with the rest of the pipeline ([d080fe5](https://github.com/Salve-Software/react-native-hotswap/commit/d080fe514efbd56fcad616f41c8bd996028ce5e1))
* publish through npm's trusted publishing ([68e8b46](https://github.com/Salve-Software/react-native-hotswap/commit/68e8b468002319554e00e683a69ce373a79fd99d))
* release with semantic-release ([434057a](https://github.com/Salve-Software/react-native-hotswap/commit/434057a8698c4260814b55aa3cd576d2e0106190))
* track dependencies with dependabot ([00ea117](https://github.com/Salve-Software/react-native-hotswap/commit/00ea117ac6b1d2229b28c8ad37d3f208892bb82c))
* typecheck and build, and unfreeze an install that could not run ([e14fe44](https://github.com/Salve-Software/react-native-hotswap/commit/e14fe44c4b2acd047f302f6a2133de8345f13d21))
* verify the javascript and compile the agent ([d812059](https://github.com/Salve-Software/react-native-hotswap/commit/d8120591e28f6c404e1cbd4cbbcf13c99e187fa8))

### 💅 Style

* apply prettier to remaining cli files ([9fa1414](https://github.com/Salve-Software/react-native-hotswap/commit/9fa141456e5ff8b52caf2776cd95601241c88066))
* **cli:** reflow a test line prettier rewrapped ([dea33ae](https://github.com/Salve-Software/react-native-hotswap/commit/dea33ae7f2764fc83cdcd4b3b5860daa906b139f))
