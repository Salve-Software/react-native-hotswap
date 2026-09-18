const {
  createRunOncePlugin,
  withAppDelegate,
  withDangerousMod,
  withMainApplication,
} = require('@expo/config-plugins');
const { readFileSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');

const pkg = require('./package.json');

const PACKAGES = 'PackageList(this).packages';
const KOTLIN_IMPORT = 'import com.hotswap.HotswapPackages';
const SWIFT_IMPORT = 'import RNHotswap';
const SWIFT_ANCHOR = '// Extension point for config-plugins';
const PODFILE_ANCHOR = 'post_install do |installer|';

const SWIFT_HOOK = `
  @objc(getModuleClassFromName:)
  func hotswapModuleClass(_ name: UnsafePointer<CChar>) -> AnyClass? {
    Hotswap.moduleClass(fromName: name)
  }
`;

const PODFILE_REQUIRE = `require Pod::Executable.execute_command('node', ['-p',
  'require.resolve("react-native-hotswap/hotswap.rb", {paths: [process.argv[1]]})',
  __dir__]).strip`;

/** Expo regenerates the three files this needs a line in, so a plugin has to put them back. */
function withHotswap(config) {
  return withPodfile(withSwift(withKotlin(config)));
}

function withKotlin(config) {
  return withMainApplication(config, (mod) => {
    let contents = mod.modResults.contents;

    if (!contents.includes(KOTLIN_IMPORT)) {
      contents = contents.replace(
        /^import com\.facebook\.react\.PackageList$/m,
        `import com.facebook.react.PackageList\n${KOTLIN_IMPORT}`,
      );
    }

    if (!contents.includes('HotswapPackages.of')) {
      contents = contents.replace(PACKAGES, `HotswapPackages.of(${PACKAGES})`);
    }

    mod.modResults.contents = contents;

    return mod;
  });
}

function withSwift(config) {
  return withAppDelegate(config, (mod) => {
    let contents = mod.modResults.contents;

    if (!contents.includes(SWIFT_ANCHOR)) {
      throw new Error(
        'react-native-hotswap: AppDelegate.swift has no config-plugin extension point',
      );
    }

    if (!contents.includes(SWIFT_IMPORT)) {
      contents = contents.replace(/^import React$/m, `import React\n${SWIFT_IMPORT}`);
    }

    if (!contents.includes('hotswapModuleClass')) {
      contents = contents.replace(SWIFT_ANCHOR, `${SWIFT_ANCHOR}\n${SWIFT_HOOK}`);
    }

    mod.modResults.contents = contents;

    return mod;
  });
}

function withPodfile(config) {
  return withDangerousMod(config, [
    'ios',
    (mod) => {
      const path = join(mod.modRequest.platformProjectRoot, 'Podfile');
      let contents = readFileSync(path, 'utf8');

      if (contents.includes('hotswap_post_install')) return mod;

      if (!contents.includes(PODFILE_ANCHOR)) {
        throw new Error('react-native-hotswap: the Podfile has no post_install block');
      }

      contents = `${PODFILE_REQUIRE}\n\n${contents}`.replace(
        PODFILE_ANCHOR,
        `${PODFILE_ANCHOR}\n    hotswap_post_install(installer)`,
      );

      writeFileSync(path, contents);

      return mod;
    },
  ]);
}

module.exports = createRunOncePlugin(withHotswap, pkg.name, pkg.version);
