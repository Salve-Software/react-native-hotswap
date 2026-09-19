import { describe, expect, it } from 'vitest';
import { declaredTypes, namesAny } from '../swift-callers.js';

describe('declaredTypes', () => {
  it('takes every kind of type a file can declare', () => {
    const source = [
      'class One {}',
      'struct Two {}',
      'enum Three {}',
      'actor Four {}',
      'protocol Five {}',
    ].join('\n');

    expect(declaredTypes(source)).toEqual(['One', 'Two', 'Three', 'Four', 'Five']);
  });

  it('is not hidden by attributes and modifiers, which is how a swap target is written', () => {
    expect(declaredTypes('@objc public final class Probe: NSObject {}')).toEqual([
      'Probe',
    ]);
  });

  it('is not hidden by an objc name in parentheses', () => {
    expect(declaredTypes('@objc(RCTProbe) class Probe: NSObject {}')).toEqual(['Probe']);
  });

  it('names a type once however many times the file mentions it', () => {
    expect(declaredTypes('class Probe {}\nextension Probe {}\nclass Probe {}')).toEqual([
      'Probe',
    ]);
  });

  it('finds nothing in a file of free functions, which nothing can reach by type', () => {
    expect(declaredTypes('func value() -> Int { 1 }')).toEqual([]);
  });
});

describe('namesAny', () => {
  it('sees a type being used', () => {
    expect(namesAny('return Born.value()', ['Born'])).toBe(true);
  });

  it('does not see a name that only appears inside a longer word', () => {
    expect(namesAny('return Bornholm.value()', ['Born'])).toBe(false);
  });

  it('sees any of them, since one file may declare several', () => {
    expect(namesAny('return Two.value()', ['One', 'Two'])).toBe(true);
  });

  it('sees nothing in a source that names none', () => {
    expect(namesAny('return 1', ['Born'])).toBe(false);
  });
});
