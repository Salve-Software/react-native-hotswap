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

describe('generateSwiftReplacement, on source that breaks a naive scan', () => {
  it('a brace inside a string does not close the body early', () => {
    const out = generateSwiftReplacement(
      'class A {\n  func go() -> String {\n    return "a { brace"\n  }\n}',
    );

    expect(out.trimEnd().endsWith('}')).toBe(true);
    expect(out).not.toMatch(/}\s*}\s*}\s*$/);
  });

  it('a nested function is local to its body and is not replaceable', () => {
    const out = generateSwiftReplacement(
      'class A {\n  func go() -> Int {\n    func inner() -> Int { return 2 }\n    return inner()\n  }\n}',
    );

    expect(out).toContain('@_dynamicReplacement(for: go())');
    expect(out).not.toContain('@_dynamicReplacement(for: inner())');
    expect(out.match(/@_dynamicReplacement/g)).toHaveLength(1);
  });

  it('a commented-out function is not mistaken for a real one', () => {
    const out = generateSwiftReplacement(
      'class A {\n  // func notReal() {}\n  func go() -> Int {\n    return 1\n  }\n}',
    );

    expect(out.match(/@_dynamicReplacement/g)).toHaveLength(1);
  });

  it('a struct is replaced too, which swift allows and the generator once refused', () => {
    const out = generateSwiftReplacement(
      'struct Fold {\n  func width() -> Int { return 1 }\n}\n',
    );

    expect(out).toContain('extension Fold {');
    expect(out).toContain('@_dynamicReplacement(for: width())');
  });

  it('an enum and an actor are replaced, since the output is an extension either way', () => {
    expect(
      generateSwiftReplacement('enum E {\n  func a() -> Int { return 1 }\n}\n'),
    ).toContain('extension E {');
    expect(
      generateSwiftReplacement('actor A {\n  func a() -> Int { return 1 }\n}\n'),
    ).toContain('extension A {');
  });

  it('an extension in the source is replaced, not skipped for lacking a type keyword', () => {
    expect(
      generateSwiftReplacement('extension Fold {\n  func a() -> Int { return 1 }\n}\n'),
    ).toContain('extension Fold {');
  });

  it('each type in a file gets its own extension, never the first one collecting them all', () => {
    const out = generateSwiftReplacement(
      'class First {\n  func a() -> Int { return 1 }\n}\nclass Second {\n  func b() -> Int { return 2 }\n}\n',
    );

    expect(out).toContain('extension First {');
    expect(out).toContain('extension Second {');
    expect(out?.indexOf('b()')).toBeGreaterThan(out?.indexOf('extension Second {') ?? 0);
  });

  it('a nested type is left to its parent, since replacing it needs the qualified name', () => {
    const out = generateSwiftReplacement(
      'class Outer {\n  func a() -> Int { return 1 }\n  struct Inner {\n    func b() -> Int { return 2 }\n  }\n}\n',
    );

    expect(out).not.toContain('extension Inner');
  });

  it('a file of top-level functions produces nothing, since there is no type to extend', () => {
    expect(generateSwiftReplacement('func a() -> Int { return 1 }\n')).toBeUndefined();
  });
});
