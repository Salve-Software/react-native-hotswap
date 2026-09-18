import { describe, expect, it } from 'vitest';
import { resolveClassName } from '../resolve-class-name.js';

const TOP_LEVEL = `package com.unfold.library

import androidx.window.layout.FoldingFeature

internal fun FoldingFeature?.toPosture(): FoldPosture = when (this?.state) {
  else -> FoldPosture.FLAT
}
`;

const DECLARES_CLASS = `package com.hotswap

class HotswapPackage : ReactPackage {
  override fun createNativeModules() = emptyList()
}
`;

const DECLARES_OBJECT = `package com.hotswap

internal object HotswapAgent {
  fun attach() = Unit
}
`;

describe('resolveClassName', () => {
  it('a file of top-level functions compiles to a Kt suffix', () => {
    expect(resolveClassName(TOP_LEVEL, 'ToPosture')).toBe(
      'com/unfold/library/ToPostureKt',
    );
  });

  it('a file declaring a class of the same name takes the bare name', () => {
    expect(resolveClassName(DECLARES_CLASS, 'HotswapPackage')).toBe(
      'com/hotswap/HotswapPackage',
    );
  });

  it('an object counts as a declaration, not only a class', () => {
    expect(resolveClassName(DECLARES_OBJECT, 'HotswapAgent')).toBe(
      'com/hotswap/HotswapAgent',
    );
  });

  it('a class with a different name than the file still gets the suffix', () => {
    expect(resolveClassName(DECLARES_CLASS, 'Something')).toBe('com/hotswap/SomethingKt');
  });

  it('source without a package declaration is refused', () => {
    expect(() => resolveClassName('fun main() {}', 'Main')).toThrow(/no package/);
  });
});
