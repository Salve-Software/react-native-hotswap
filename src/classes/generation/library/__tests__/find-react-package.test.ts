import { describe, expect, it } from 'vitest';
import { findReactPackage } from '../find-react-package.js';

describe('findReactPackage', () => {
  it('qualifies the class with the package it was declared in', () => {
    const source = [
      'package com.probe',
      '',
      'class ProbePackage : ReactPackage {',
      '}',
    ].join('\n');

    expect(findReactPackage(source)).toBe('com.probe.ProbePackage');
  });

  it('takes the base classes React Native hands out, not only the bare interface', () => {
    const source = [
      'package com.unfold',
      '',
      'public class UnfoldPackage : BaseReactPackage() {',
      '}',
    ].join('\n');

    expect(findReactPackage(source)).toBe('com.unfold.UnfoldPackage');
  });

  it('takes a TurboReactPackage too', () => {
    const source = [
      'package com.probe',
      '',
      'class ProbePackage : TurboReactPackage() {',
      '}',
    ].join('\n');

    expect(findReactPackage(source)).toBe('com.probe.ProbePackage');
  });

  it('takes a Java class that implements it', () => {
    const source = [
      'package com.probe;',
      '',
      'public class ProbePackage implements ReactPackage {',
      '}',
    ].join('\n');

    expect(findReactPackage(source)).toBe('com.probe.ProbePackage');
  });

  it('finds nothing in a file that declares no package class', () => {
    const source = ['package com.probe', '', 'object ProbeValues {', '}'].join('\n');

    expect(findReactPackage(source)).toBeUndefined();
  });

  it('refuses a class with no package declaration, which would not resolve', () => {
    expect(findReactPackage('class ProbePackage : ReactPackage {')).toBeUndefined();
  });
});
