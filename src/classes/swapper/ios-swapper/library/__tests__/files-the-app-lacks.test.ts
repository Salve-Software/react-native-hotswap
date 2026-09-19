import { describe, expect, it } from 'vitest';
import { filesTheAppLacks } from '../files-the-app-lacks.js';

describe('filesTheAppLacks', () => {
  it('names a file that was written after the app was built', () => {
    expect(
      filesTheAppLacks(['/a/Probe.swift'], ['/a/Probe.swift', '/a/Born.swift']),
    ).toEqual(['/a/Born.swift']);
  });

  it('names nothing when the app was built from everything present', () => {
    expect(filesTheAppLacks(['/a/Probe.swift'], ['/a/Probe.swift'])).toEqual([]);
  });

  it('matches on the file name, since the two lists take different paths to it', () => {
    const built = ['/derived/../a/Probe.swift'];

    expect(filesTheAppLacks(built, ['/a/Probe.swift'])).toEqual([]);
  });

  it('names every new file, because one may be why another compiles', () => {
    const lacking = filesTheAppLacks(
      ['/a/Probe.swift'],
      ['/a/Probe.swift', '/a/One.swift', '/a/Two.swift'],
    );

    expect(lacking).toEqual(['/a/One.swift', '/a/Two.swift']);
  });

  it('names everything when the app was built from nothing this package knows', () => {
    expect(filesTheAppLacks([], ['/a/Probe.swift'])).toEqual(['/a/Probe.swift']);
  });
});
