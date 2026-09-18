import { describe, expect, it } from 'vitest';
import { explainJvmtiError } from '../explain-jvmti-error.js';

describe('explainJvmtiError', () => {
  it('removing a method is the trap worth naming, since adding one works', () => {
    expect(explainJvmtiError(67)).toMatch(/removed/);
  });

  it('a class the app has not reached tells the developer what to do', () => {
    expect(explainJvmtiError(21)).toMatch(/exercise the code path/);
  });

  it('an unknown code still reports its number rather than going quiet', () => {
    expect(explainJvmtiError(255)).toBe('jvmtiError 255');
  });
});
