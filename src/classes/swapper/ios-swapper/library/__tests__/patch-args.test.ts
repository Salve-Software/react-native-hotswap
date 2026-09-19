import { describe, expect, it } from 'vitest';
import { patchArgs, sourceListPath } from '../patch-args.js';

const where = { map: '/tmp/map.json', cache: '/tmp/cache' };

describe('patchArgs', () => {
  it('keeps the module name, since a patch belongs to the module it replaces in', () => {
    expect(patchArgs(['swiftc', '-module-name', 'probe'], where)).toContain('probe');
  });

  it('emits objects through the map, so only the patch object gets linked', () => {
    const args = patchArgs(['swiftc'], where);

    expect(args).toContain('-c');
    expect(args.slice(args.indexOf('-output-file-map'))).toContain('/tmp/map.json');
  });

  it('points the module cache somewhere that survives, which is the whole saving', () => {
    const args = patchArgs(['swiftc'], where);

    expect(args.slice(args.indexOf('-module-cache-path'))).toContain('/tmp/cache');
  });

  it('drops the cache Xcode chose, or the run would fill a directory it owns', () => {
    const args = patchArgs(['swiftc', '-module-cache-path', '/derived/cache'], where);

    expect(args).not.toContain('/derived/cache');
  });

  it('drops the outputs that point into a build this one is not part of', () => {
    const args = patchArgs(
      [
        'swiftc',
        '-o',
        '/derived/out.o',
        '-emit-module-path',
        '/derived/probe.swiftmodule',
      ],
      where,
    );

    expect(args).not.toContain('/derived/out.o');
    expect(args).not.toContain('/derived/probe.swiftmodule');
    expect(args).not.toContain('-emit-module-path');
  });

  it('drops whole-module, which would fold every file into one object', () => {
    expect(patchArgs(['swiftc', '-whole-module-optimization'], where)).not.toContain(
      '-whole-module-optimization',
    );
  });

  it('drops the const-gather pair, which takes an argument after -Xfrontend', () => {
    const args = patchArgs(
      [
        'swiftc',
        '-Xfrontend',
        '-const-gather-protocols-file',
        '-Xfrontend',
        '/a.json',
        '-Onone',
      ],
      where,
    );

    expect(args).not.toContain('/a.json');
    expect(args).toContain('-Onone');
  });
});

describe('sourceListPath', () => {
  it('finds the list Xcode passes the sources in', () => {
    expect(sourceListPath(['swiftc', '@/build/probe.SwiftFileList'])).toBe(
      '/build/probe.SwiftFileList',
    );
  });

  it('finds nothing when the sources were passed some other way', () => {
    expect(sourceListPath(['swiftc', '/a/Probe.swift'])).toBeUndefined();
  });
});
