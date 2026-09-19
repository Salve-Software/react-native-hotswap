export const DROPPED_WITH_VALUE = [
  '-o',
  '-output-file-map',
  '-emit-module-path',
  '-emit-objc-header-path',
  '-emit-dependencies-path',
  '-serialize-diagnostics-path',
  '-index-store-path',
  '-emit-const-values-path',
  '-emit-module-interface-path',
  '-emit-private-module-interface-path',
  '-emit-package-module-interface-path',
  '-module-cache-path',
];

export const DROPPED_FLAGS = [
  '-emit-module',
  '-emit-objc-header',
  '-emit-dependencies',
  '-serialize-diagnostics',
  '-emit-const-values',
  '-whole-module-optimization',
  '-incremental',
  '-index-system-modules',
];

export const NATIVE_DROPPED_WITH_VALUE = [
  '-o',
  '-MF',
  '-MT',
  '--serialize-diagnostics',
  '-serialize-diagnostics',
  '-index-store-path',
];

export const NATIVE_DROPPED_FLAGS = ['-MMD', '-MD'];
