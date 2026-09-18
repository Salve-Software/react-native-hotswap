import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { findPodName } from '../find-pod-name.js';

function moduleWith(files) {
  const root = mkdtempSync(join(tmpdir(), 'pod-'));
  for (const name of files) writeFileSync(join(root, name), '');

  return root;
}

describe('findPodName', () => {
  it('the podspec name is the xcode scheme, and it need not match the package', () => {
    expect(findPodName(moduleWith(['package.json', 'Unfold.podspec']))).toBe('Unfold');
  });

  it('a module with no podspec has no iOS side', () => {
    expect(findPodName(moduleWith(['package.json']))).toBeUndefined();
  });
});
