import { describe, expect, it } from 'vitest';
import { resolveOverrides } from '../resolve-overrides.js';

const ROOT = '/repos/react-native-unfold';

describe('resolveOverrides', () => {
  it('a relative path reads against the module, since metro runs from the example app', () => {
    const resolved = resolveOverrides(ROOT, { project: 'example/android' });

    expect(resolved.project).toBe('/repos/react-native-unfold/example/android');
  });

  it('every watched directory is resolved, not only the first', () => {
    const resolved = resolveOverrides(ROOT, { watch: ['ios', 'cpp'] });

    expect(resolved.watch).toEqual([
      '/repos/react-native-unfold/ios',
      '/repos/react-native-unfold/cpp',
    ]);
  });

  it('an absolute override is left as written', () => {
    const resolved = resolveOverrides(ROOT, { classes: '/tmp/classes' });

    expect(resolved.classes).toBe('/tmp/classes');
  });

  it('a value that is not a path is carried through untouched', () => {
    expect(resolveOverrides(ROOT, { port: 9000 }).port).toBe(9000);
  });

  it('the overrides given are not mutated, so the file on disk reads the same twice', () => {
    const written = { project: 'example/android' };
    resolveOverrides(ROOT, written);

    expect(written.project).toBe('example/android');
  });
});
