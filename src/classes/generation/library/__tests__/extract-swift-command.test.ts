import { describe, expect, it } from 'vitest';
import { extractSwiftCommand } from '../extract-swift-command.js';

const LOG = `
SwiftDriver probe normal arm64
    cd /repo/ios/Pods
    builtin-SwiftDriver -- /usr/bin/swiftc -module-name probe -target arm64-apple-ios18.0-simulator -Onone @/build/probe.SwiftFileList -sdk /SDK -c
SwiftDriver other normal arm64
    builtin-SwiftDriver -- /usr/bin/swiftc -module-name other -target arm64-apple-ios18.0-simulator -Onone -c
`;

const BOTH = `
SwiftDriver probe normal x86_64
    builtin-SwiftDriver -- /usr/bin/swiftc -module-name probe -target x86_64-apple-ios18.0-simulator -Onone @/build/x86.SwiftFileList -c
SwiftDriver probe normal arm64
    builtin-SwiftDriver -- /usr/bin/swiftc -module-name probe -target arm64-apple-ios18.0-simulator -Onone @/build/arm.SwiftFileList -c
`;

describe('extractSwiftCommand', () => {
  it('finds the invocation for the module asked for, not the first one', () => {
    expect(extractSwiftCommand(LOG, { moduleName: 'other', arch: 'arm64' })).toContain('other');
    expect(extractSwiftCommand(LOG, { moduleName: 'probe', arch: 'arm64' })).toContain(
      '@/build/probe.SwiftFileList',
    );
  });

  it('takes the architecture the simulator runs, whichever came first', () => {
    expect(extractSwiftCommand(BOTH, { moduleName: 'probe', arch: 'arm64' })).toContain(
      '@/build/arm.SwiftFileList',
    );
    expect(extractSwiftCommand(BOTH, { moduleName: 'probe', arch: 'x86_64' })).toContain(
      '@/build/x86.SwiftFileList',
    );
  });

  it('an architecture the log never built has no invocation', () => {
    expect(extractSwiftCommand(LOG, { moduleName: 'probe', arch: 'x86_64' })).toBeUndefined();
  });

  it('a module the log never compiled has no invocation', () => {
    expect(extractSwiftCommand(LOG, { moduleName: 'missing', arch: 'arm64' })).toBeUndefined();
  });

  it('the escaping xcodebuild puts in front of = is undone', () => {
    const log =
      'builtin-SwiftDriver -- /usr/bin/swiftc -module-name a -target arm64-apple-ios18.0-simulator -DX\\=1';

    expect(extractSwiftCommand(log, { moduleName: 'a', arch: 'arm64' })).toContain('-DX=1');
  });

  it('a log with no swift compile at all yields nothing', () => {
    expect(
      extractSwiftCommand('CompileC foo.m\n', { moduleName: 'probe', arch: 'arm64' }),
    ).toBeUndefined();
  });
});
