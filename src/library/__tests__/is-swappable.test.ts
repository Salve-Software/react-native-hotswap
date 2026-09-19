import { describe, expect, it } from 'vitest';
import { isSwappable } from '../is-swappable.js';

describe('isSwappable', () => {
  it('takes every language a swapper knows', () => {
    for (const path of [
      'a/Probe.kt',
      'a/Probe.swift',
      'a/probe.cpp',
      'a/probe.cc',
      'a/probe.cxx',
    ])
      expect(isSwappable(path)).toBe(true);
  });

  it('takes a header, which is swapped through what includes it', () => {
    for (const path of ['a/probe.h', 'a/probe.hpp', 'a/probe.hh', 'a/probe.hxx'])
      expect(isSwappable(path)).toBe(true);
  });

  it('refuses Objective-C, which would define its classes a second time', () => {
    expect(isSwappable('a/Probe.m')).toBe(false);
    expect(isSwappable('a/Probe.mm')).toBe(false);
  });

  it('refuses a file no swapper compiles', () => {
    expect(isSwappable('a/App.tsx')).toBe(false);
    expect(isSwappable('a/build.gradle')).toBe(false);
  });

  it('matches the extension, not the name, so a directory called probe.kt does not count', () => {
    expect(isSwappable('probe.kt/Probe.java')).toBe(false);
  });
});
