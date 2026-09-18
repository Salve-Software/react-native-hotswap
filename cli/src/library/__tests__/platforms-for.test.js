import { describe, expect, it } from 'vitest';
import { platformsFor } from '../platforms-for.js';

describe('platformsFor', () => {
  it('kotlin goes to android', () => {
    expect(platformsFor('android/src/main/java/com/unfold/ToPosture.kt')).toEqual([
      'android',
    ]);
  });

  it('swift goes to ios', () => {
    expect(platformsFor('ios/HybridUnfoldBridge.swift')).toEqual(['ios']);
  });

  it('c++ goes to both, since one file is compiled into both apps', () => {
    expect(platformsFor('cpp/Fold.cpp')).toEqual(['android', 'ios']);
    expect(platformsFor('cpp/Fold.cc')).toEqual(['android', 'ios']);
  });

  it('objective-c++ is not handled, since including it would redefine its classes', () => {
    expect(platformsFor('ios/Unfold.mm')).toEqual([]);
  });

  it('a java file is not handled, since the dexer path assumes kotlin output', () => {
    expect(platformsFor('android/src/main/java/Legacy.java')).toEqual([]);
  });

  it('an editor swap file is ignored rather than compiled', () => {
    expect(platformsFor('ToPosture.kt.swp')).toEqual([]);
  });
});
