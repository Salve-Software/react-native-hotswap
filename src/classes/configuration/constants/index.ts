export const CONFIG_FILE = 'hotswap.config.json';

export const INTERMEDIATES = '/Build/Intermediates.noindex';

export const FALLBACK_ABI = 'arm64-v8a';

export const PODSPEC = '.podspec';

/** The overrides read as paths, which resolve against the module rather than cwd. */
export const OVERRIDDEN_PATHS = [
  'project',
  'classes',
  'specs',
  'generated',
  'patchDir',
] as const;
