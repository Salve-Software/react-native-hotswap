export const DROPPED_WITH_VALUE = [
  '-output-file-map',
  '-emit-module-path',
  '-emit-objc-header-path',
  '-index-store-path',
  '-clang-build-session-file',
  '-working-directory',
];

// -import-underlying-module wants an ObjC module named after -module-name, new every time.
export const DROPPED_FLAGS = [
  '-c',
  '-emit-module',
  '-emit-objc-header',
  '-emit-dependencies',
  '-serialize-diagnostics',
  '-emit-const-values',
  '-incremental',
  '-enable-batch-mode',
  '-save-temps',
  '-use-frontend-parseable-output',
  '-experimental-emit-module-separately',
  '-validate-clang-modules-once',
  '-no-color-diagnostics',
  '-import-underlying-module',
];
