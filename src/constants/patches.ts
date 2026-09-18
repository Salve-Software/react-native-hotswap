import type { Patch } from '../types/index.js';

type Blank = Omit<Patch, 'contents'>;

export const SWIFT_PATCH: Blank = {
  file: 'HotswapPatch.swift',
  placeholder: 'import Foundation\n',
};

export const NATIVE_PATCH: Blank = {
  file: 'HotswapPatchNative.mm',
  placeholder: '\n',
};

/** Every file Xcode has to know about before it can compile any swap at all. */
export const PATCHES: Blank[] = [SWIFT_PATCH, NATIVE_PATCH];
