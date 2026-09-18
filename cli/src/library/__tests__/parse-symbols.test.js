import { describe, expect, it } from 'vitest';
import { parseSymbols } from '../parse-symbols.js';

describe('parseSymbols', () => {
  it('a defined function is read with the room it occupies', () => {
    expect(parseSymbols('_Z16hotswapProbeFreev T 1234 20')).toEqual([
      { name: '_Z16hotswapProbeFreev', size: 32 },
    ]);
  });

  it('a local function counts too, since C++ gives internal linkage a lowercase t', () => {
    expect(parseSymbols('_ZL6helperv t 100 10')).toEqual([{ name: '_ZL6helperv', size: 16 }]);
  });

  it('a weak function counts, which is what an inline definition becomes', () => {
    expect(parseSymbols('_ZN5Thing5valueEv W 200 40')).toHaveLength(1);
  });

  it('data is left out, so patching never aims a pointer at a fresh copy of a global', () => {
    expect(parseSymbols('someGlobal d 300 8\nGCC_except_table0 r 400 0')).toEqual([]);
  });

  it('a symbol with no measurable size is skipped rather than guessed at', () => {
    expect(parseSymbols('_Z3oddv T 500')).toEqual([]);
  });

  it('blank lines in nm output are ignored', () => {
    expect(parseSymbols('\n\n_Z3foov T 1 10\n\n')).toHaveLength(1);
  });
});
