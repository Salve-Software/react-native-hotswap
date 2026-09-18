import { describe, expect, it } from 'vitest';
import { parseIncludes } from '../parse-includes.js';

describe('parseIncludes', () => {
  it('a quoted include is a file the project owns', () => {
    expect(parseIncludes('#include "HotswapProbe.hpp"')).toEqual(['HotswapProbe.hpp']);
  });

  it('an angled include is left out, since it belongs to a framework or the sdk', () => {
    expect(parseIncludes('#include <vector>\n#include <os/log.h>')).toEqual([]);
  });

  it('a relative include keeps its path, which is how it resolves', () => {
    expect(parseIncludes('#include "../cpp/Fold.hpp"')).toEqual(['../cpp/Fold.hpp']);
  });

  it('spacing around the directive does not hide it', () => {
    expect(parseIncludes('  #  include   "A.hpp"')).toEqual(['A.hpp']);
  });

  it('an import in a comment is still matched, which only costs an extra compile', () => {
    expect(parseIncludes('#include "A.hpp"\n#include "B.hpp"')).toEqual([
      'A.hpp',
      'B.hpp',
    ]);
  });

  it('a file with no includes reaches nothing', () => {
    expect(parseIncludes('int main() { return 0; }')).toEqual([]);
  });
});
