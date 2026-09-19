import { describe, expect, it } from 'vitest';
import { extractClangCommand } from '../extract-clang-command.js';

const log = (...lines: string[]) => lines.join('\n');

const compile = (arch: string) =>
  log(
    `CompileC /build/probe.build/Objects-normal/${arch}/HotswapPatchNative.o /a/HotswapPatchNative.mm`,
    '    cd /a/Pods',
    `    /toolchain/usr/bin/clang -x objective-c++ -target ${arch}-apple-ios15.1-simulator -c /a/HotswapPatchNative.mm -o /build/probe.build/Objects-normal/${arch}/HotswapPatchNative.o`,
  );

describe('extractClangCommand', () => {
  it('takes the invocation for the file asked about', () => {
    const args = extractClangCommand(compile('arm64'), {
      file: 'HotswapPatchNative.mm',
      arch: 'arm64',
    });

    expect(args?.[0]).toBe('/toolchain/usr/bin/clang');
    expect(args).toContain('-x');
  });

  it('takes the architecture the simulator runs, not the first one Xcode compiled', () => {
    const both = log(compile('x86_64'), compile('arm64'));
    const args = extractClangCommand(both, {
      file: 'HotswapPatchNative.mm',
      arch: 'arm64',
    });

    expect(args?.[args.indexOf('-o') + 1]).toContain('/arm64/');
  });

  it('finds nothing when that architecture was never compiled', () => {
    expect(
      extractClangCommand(compile('x86_64'), {
        file: 'HotswapPatchNative.mm',
        arch: 'arm64',
      }),
    ).toBeUndefined();
  });

  it('finds nothing in a log that compiled something else', () => {
    expect(
      extractClangCommand(compile('arm64'), { file: 'Other.mm', arch: 'arm64' }),
    ).toBeUndefined();
  });

  it('finds nothing when the line after names no compiler', () => {
    const broken = log(
      'CompileC /x/HotswapPatchNative.o /a/HotswapPatchNative.mm',
      '    cd /a',
    );

    expect(
      extractClangCommand(broken, { file: 'HotswapPatchNative.mm', arch: 'arm64' }),
    ).toBeUndefined();
  });
});
