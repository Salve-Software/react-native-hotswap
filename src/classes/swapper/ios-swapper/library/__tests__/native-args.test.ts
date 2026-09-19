import { describe, expect, it } from 'vitest';
import { nativeArgs } from '../native-args.js';

const where = { object: '/tmp/patch.o', cache: '/tmp/cache' };

describe('nativeArgs', () => {
  it('writes the object where this package can reach it', () => {
    const args = nativeArgs(['clang'], where);

    expect(args.slice(args.indexOf('-o'))).toContain('/tmp/patch.o');
  });

  it('points the module cache somewhere that survives, which is the whole saving', () => {
    expect(nativeArgs(['clang'], where)).toContain('-fmodules-cache-path=/tmp/cache');
  });

  it('drops the cache Xcode chose, since two would defeat the point', () => {
    const args = nativeArgs(['clang', '-fmodules-cache-path=/derived/cache'], where);

    expect(args).not.toContain('-fmodules-cache-path=/derived/cache');
  });

  it('drops the dependency and diagnostic outputs, which point into Xcode is build', () => {
    const args = nativeArgs(
      [
        'clang',
        '-MMD',
        '-MT',
        'dependencies',
        '-MF',
        '/derived/a.d',
        '-c',
        '/a/Patch.mm',
      ],
      where,
    );

    expect(args).not.toContain('-MMD');
    expect(args).not.toContain('/derived/a.d');
    expect(args).toContain('/a/Patch.mm');
  });

  it('keeps the flags that decide what the object is', () => {
    const args = nativeArgs(['clang', '-x', 'objective-c++', '-std=c++20', '-c'], where);

    expect(args).toContain('objective-c++');
    expect(args).toContain('-std=c++20');
    expect(args).toContain('-c');
  });
});
