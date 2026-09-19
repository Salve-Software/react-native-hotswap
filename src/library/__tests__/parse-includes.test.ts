import { describe, expect, it } from 'vitest';
import { parseIncludes } from '../parse-includes.js';

describe('parseIncludes', () => {
  it('takes the quoted includes, which are the ones a project owns', () => {
    const source = ['#include "probe.hpp"', '#include "shape.hpp"'].join('\n');

    expect(parseIncludes(source)).toEqual(['probe.hpp', 'shape.hpp']);
  });

  it('leaves an angled include alone, since it belongs to a framework', () => {
    expect(parseIncludes('#include <vector>')).toEqual([]);
  });

  it('follows a path, not only a bare file name', () => {
    expect(parseIncludes('#include "../shared/probe.hpp"')).toEqual([
      '../shared/probe.hpp',
    ]);
  });

  it('takes the spacing the preprocessor allows', () => {
    const source = ['  #include "a.hpp"', '#  include   "b.hpp"'].join('\n');

    expect(parseIncludes(source)).toEqual(['a.hpp', 'b.hpp']);
  });

  it('ignores a line-commented include, which names no real dependency', () => {
    expect(parseIncludes('// #include "stale.hpp"')).toEqual([]);
  });

  it('finds nothing in a file that includes nothing', () => {
    expect(parseIncludes('int value() { return 1; }')).toEqual([]);
  });
});
