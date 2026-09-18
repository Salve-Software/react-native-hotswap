import { describe, expect, it } from 'vitest';
import { extractSwiftCommand } from '../extract-swift-command.js';

const LOG = `
SwiftDriver probe normal arm64
    cd /repo/ios/Pods
    builtin-SwiftDriver -- /usr/bin/swiftc -module-name probe -Onone @/build/probe.SwiftFileList -sdk /SDK -c
SwiftDriver other normal arm64
    builtin-SwiftDriver -- /usr/bin/swiftc -module-name other -Onone -c
`;

describe('extractSwiftCommand', () => {
  it('finds the invocation for the module asked for, not the first one', () => {
    expect(extractSwiftCommand(LOG, 'other')).toContain('other');
    expect(extractSwiftCommand(LOG, 'probe')).toContain('@/build/probe.SwiftFileList');
  });

  it('a module the log never compiled has no invocation', () => {
    expect(extractSwiftCommand(LOG, 'missing')).toBeUndefined();
  });

  it('the escaping xcodebuild puts in front of = is undone', () => {
    const log = 'builtin-SwiftDriver -- /usr/bin/swiftc -module-name a -DX\\=1';

    expect(extractSwiftCommand(log, 'a')).toContain('-DX=1');
  });

  it('a log with no swift compile at all yields nothing', () => {
    expect(extractSwiftCommand('CompileC foo.m\n', 'probe')).toBeUndefined();
  });
});
