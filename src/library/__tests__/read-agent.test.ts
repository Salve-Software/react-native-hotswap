import { describe, expect, it } from 'vitest';
import { readAgent } from '../read-agent.js';

const port = 8099;

describe('readAgent', () => {
  it('names the app that answered, so the port is not taken on faith', () => {
    const { ok, detail } = readAgent('com.probe', {
      port,
      listening: true,
      app: 'com.probe',
    });

    expect(ok).toBe(true);
    expect(detail).toBe('port 8099, com.probe');
  });

  it('refuses when another app holds the port, which is a swap landing elsewhere', () => {
    const { ok, detail } = readAgent('com.probe', {
      port,
      listening: true,
      app: 'com.other',
    });

    expect(ok).toBe(false);
    expect(detail).toBe('port 8099 is held by com.other, not com.probe');
  });

  it('says the agent is old rather than failing, since it still swaps', () => {
    const { ok, detail } = readAgent('com.probe', {
      port,
      listening: true,
      app: undefined,
    });

    expect(ok).toBe(true);
    expect(detail).toContain('too old');
  });

  it('accepts any app when the project never said which one it builds', () => {
    expect(readAgent(undefined, { port, listening: true, app: 'com.other' }).ok).toBe(
      true,
    );
  });

  it('reports nothing listening as the plain port it is', () => {
    const { ok, detail } = readAgent('com.probe', {
      port,
      listening: false,
      app: undefined,
    });

    expect(ok).toBe(false);
    expect(detail).toBe('port 8099');
  });
});
