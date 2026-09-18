const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const { withHotswap } = require('react-native-hotswap/metro.cjs');
const { join } = require('node:path');

/** @type {import('@react-native/metro-config').MetroConfig} */
const config = {
  // The module being swapped lives beside the app rather than one level up, which is the
  // layout withHotswap guesses, so it is named here.
  watchFolders: [join(__dirname, 'probe')],
};

module.exports = withHotswap(mergeConfig(getDefaultConfig(__dirname), config), {
  root: join(__dirname, 'probe'),
});
