import { describe, expect, it } from 'vitest';
import { platformFor } from '../platform-for.js';

describe('platformFor', () => {
  it('kotlin goes to android', () => {
    expect(platformFor('android/src/main/java/com/unfold/ToPosture.kt')).toBe('android');
  });

  it('swift goes to ios', () => {
    expect(platformFor('ios/HybridUnfoldBridge.swift')).toBe('ios');
  });

  it('c++ goes to ios, where a dylib can be loaded', () => {
    expect(platformFor('cpp/Fold.cpp')).toBe('ios');
    expect(platformFor('cpp/Fold.cc')).toBe('ios');
  });

  it('objective-c++ is not handled, since including it would redefine its classes', () => {
    expect(platformFor('ios/Unfold.mm')).toBeUndefined();
  });

  it('routing reads the extension only, so the watcher is what keeps android c++ out', () => {
    expect(platformFor('android/src/main/cpp/agent.cpp')).toBe('ios');
  });

  it('a java file is not handled, since the dexer path assumes kotlin output', () => {
    expect(platformFor('android/src/main/java/Legacy.java')).toBeUndefined();
  });

  it('an editor swap file is ignored rather than compiled', () => {
    expect(platformFor('ToPosture.kt.swp')).toBeUndefined();
  });
});
