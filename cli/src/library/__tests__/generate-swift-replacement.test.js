import { describe, expect, it } from 'vitest';
import { generateSwiftReplacement } from '../generate-swift-replacement.js';

const BRIDGE = `import Foundation
import NitroModules

/** Reads fold geometry from UIKit. */
class HybridUnfoldBridge: HybridUnfoldBridgeSpec {

  func getState() throws -> FoldState {
    return FLAT_PHONE
  }

  func addListener(
    listener: @escaping (_ state: FoldState) -> Void
  ) throws -> () -> Void {
    listener(FLAT_PHONE)

    return {}
  }
}
`;

describe('generateSwiftReplacement', () => {
  it('names the original by its argument labels, which is what swift matches on', () => {
    const out = generateSwiftReplacement(BRIDGE);

    expect(out).toContain('@_dynamicReplacement(for: getState())');
    expect(out).toContain('@_dynamicReplacement(for: addListener(listener:))');
  });

  it('extends the class rather than redeclaring it', () => {
    expect(generateSwiftReplacement(BRIDGE)).toContain('extension HybridUnfoldBridge {');
  });

  it('carries the imports over, since the extension compiles on its own', () => {
    const out = generateSwiftReplacement(BRIDGE);

    expect(out).toContain('import NitroModules');
  });

  it('keeps a body with nested braces intact', () => {
    expect(generateSwiftReplacement(BRIDGE)).toContain('return {}');
  });

  it('a file with no class has nothing to replace', () => {
    expect(generateSwiftReplacement('import Foundation\nlet x = 1')).toBeUndefined();
  });

  it('a class with no methods has nothing to replace', () => {
    expect(generateSwiftReplacement('class Empty {\n  let x = 1\n}')).toBeUndefined();
  });
});
