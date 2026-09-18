import { describe, expect, it } from 'vitest';
import { PATCHES, patchFor } from '../patch-for.js';

const SWIFT = `import Foundation

class HybridUnfoldBridge: HybridUnfoldBridgeSpec {
  func getState() -> FoldState {
    return FLAT_PHONE
  }
}
`;

describe('patchFor', () => {
  it('swift is rewritten into the file the pod globs', () => {
    const patch = patchFor('ios/HybridUnfoldBridge.swift', SWIFT);

    expect(patch.file).toBe('HotswapPatch.swift');
    expect(patch.contents).toContain('@_dynamicReplacement(for: getState())');
  });

  it('swift with nothing replaceable produces no patch at all', () => {
    expect(patchFor('ios/Empty.swift', 'import Foundation\n')).toBeUndefined();
  });

  it('c++ is included rather than rewritten, so xcode supplies the flags', () => {
    const patch = patchFor('/src/cpp/Fold.cpp', 'int fold() { return 1; }');

    expect(patch.file).toBe('HotswapPatchNative.mm');
    expect(patch.contents).toBe('#include "/src/cpp/Fold.cpp"\n');
  });

  it('the c++ patch is included by absolute path, so its own relative includes resolve', () => {
    const patch = patchFor('/deep/nested/cpp/Fold.cpp', '');

    expect(patch.contents).toContain('/deep/nested/cpp/Fold.cpp');
  });

  it('every patch carries a placeholder, since all of them exist before pod install', () => {
    expect(PATCHES).toHaveLength(2);
    expect(PATCHES.every(({ file, placeholder }) => file && placeholder)).toBe(true);
  });
});
