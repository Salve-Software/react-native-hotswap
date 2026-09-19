import { describe, expect, it } from 'vitest';
import { reason } from '../reason.js';

describe('reason', () => {
  it('takes the compiler error, not the command that produced it', () => {
    const cause = {
      message: `Command failed: swiftc ${'-Xcc -I/a/very/long/path '.repeat(40)}`,
      stderr:
        "/a/Probe.swift:9:12: error: cannot find 'Born' in scope\n1 error generated.",
    };

    expect(reason(cause)).toBe("/a/Probe.swift:9:12: error: cannot find 'Born' in scope");
  });

  it('takes a bare error line too, which is how the driver reports its own', () => {
    expect(reason({ stderr: 'error: unknown argument: -fbogus' })).toBe(
      'error: unknown argument: -fbogus',
    );
  });

  it('falls back to the first thing said when nothing names an error', () => {
    expect(reason({ stderr: '\n\nninja: build stopped.\n' })).toBe(
      'ninja: build stopped.',
    );
  });

  it('falls back to the message when there is no output at all', () => {
    expect(reason(new Error('the agent did not reply'))).toBe('the agent did not reply');
  });

  it('never prints a wall, however long the line is', () => {
    const line = reason({ stderr: `error: ${'x'.repeat(500)}` });

    expect(line.length).toBeLessThanOrEqual(201);
    expect(line.endsWith('…')).toBe(true);
  });

  it('says so rather than printing nothing when a failure carries no words', () => {
    expect(reason({})).toBe('failed, with nothing to say why');
  });
});
