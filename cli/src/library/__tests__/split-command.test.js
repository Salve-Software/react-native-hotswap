import { describe, expect, it } from 'vitest';
import { splitCommand } from '../split-command.js';

describe('splitCommand', () => {
  it('a recorded compile command splits into its arguments', () => {
    expect(splitCommand('clang++ --target=aarch64 -c a.cpp')).toEqual([
      'clang++',
      '--target=aarch64',
      '-c',
      'a.cpp',
    ]);
  });

  it('a quoted path with a space stays one argument', () => {
    expect(splitCommand('clang++ -I"/My Documents/inc" -c a.cpp')).toEqual([
      'clang++',
      '-I/My Documents/inc',
      '-c',
      'a.cpp',
    ]);
  });

  it('an escaped space stays inside its argument', () => {
    expect(splitCommand('clang++ -I/My\\ Docs -c a.cpp')).toEqual([
      'clang++',
      '-I/My Docs',
      '-c',
      'a.cpp',
    ]);
  });

  it('a define carrying quotes keeps the value the build gave it', () => {
    expect(splitCommand('clang++ -DNAME="a b" -c a.cpp')).toEqual([
      'clang++',
      '-DNAME=a b',
      '-c',
      'a.cpp',
    ]);
  });

  it('runs of whitespace do not produce empty arguments', () => {
    expect(splitCommand('  clang++   -c    a.cpp ')).toEqual(['clang++', '-c', 'a.cpp']);
  });

  it('an empty quoted argument survives, since dropping it shifts everything after it', () => {
    expect(splitCommand('clang++ "" -c a.cpp')).toEqual(['clang++', '', '-c', 'a.cpp']);
  });
});
