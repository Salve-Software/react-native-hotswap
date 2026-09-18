import type { Patch } from '../types/index.js';

type Blank = Omit<Patch, 'contents'>;

/** The file a Swift change is written into, as an extension of dynamic replacements. */
export const SWIFT_PATCH: Blank = {
  file: 'HotswapPatch.swift',
  placeholder: 'import Foundation\n',
};

/** The file a C++ change is included into, so Xcode compiles it with the target's flags. */
export const NATIVE_PATCH: Blank = {
  file: 'HotswapPatchNative.mm',
  placeholder: '\n',
};

/** Every file Xcode has to know about before it can compile any swap at all. */
export const PATCHES: Blank[] = [SWIFT_PATCH, NATIVE_PATCH];
