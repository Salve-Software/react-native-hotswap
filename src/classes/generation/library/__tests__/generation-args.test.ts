import { describe, expect, it } from 'vitest';
import { generationArgs } from '../generation-args.js';

const OPTIONS = { moduleName: 'HotswapGen1', out: '/tmp/gen.dylib' };

function run(captured: string[]): string[] {
  return generationArgs(captured, OPTIONS);
}

describe('generationArgs', () => {
  it('the module is renamed, which is what keeps two generations distinct types', () => {
    const args = run(['swiftc', '-module-name', 'probe', '-sdk', '/SDK']);

    expect(args).toContain('HotswapGen1');
    expect(args).not.toContain('probe');
  });

  it('a library comes out instead of objects', () => {
    const args = run(['swiftc', '-module-name', 'probe', '-c']);

    expect(args).not.toContain('-c');
    expect(args.join(' ')).toContain('-emit-library -o /tmp/gen.dylib');
  });

  it('undefined symbols resolve at load, since the app supplies them', () => {
    expect(run(['swiftc', '-module-name', 'probe']).join(' ')).toContain(
      'dynamic_lookup',
    );
  });

  it('the underlying module import goes, since no ObjC module carries the new name', () => {
    expect(
      run(['swiftc', '-module-name', 'probe', '-import-underlying-module']),
    ).not.toContain('-import-underlying-module');
  });

  it("Xcode's own output paths go, along with the flag that named them", () => {
    const args = run([
      'swiftc',
      '-module-name',
      'probe',
      '-output-file-map',
      '/build/map.json',
    ]);

    expect(args).not.toContain('-output-file-map');
    expect(args).not.toContain('/build/map.json');
  });

  it('the const-gather pair goes whole, or its path is read as a source file', () => {
    const args = run([
      'swiftc',
      '-module-name',
      'probe',
      '-Xfrontend',
      '-const-gather-protocols-file',
      '-Xfrontend',
      '/build/protocols.json',
      '-sdk',
      '/SDK',
    ]);

    expect(args).not.toContain('/build/protocols.json');
    expect(args).toContain('-sdk');
  });

  it('the search paths are kept, which is the whole reason for capturing', () => {
    const args = run([
      'swiftc',
      '-module-name',
      'probe',
      '-Xcc',
      '-I/Pods/Headers/Public',
    ]);

    expect(args).toContain('-I/Pods/Headers/Public');
  });
});
