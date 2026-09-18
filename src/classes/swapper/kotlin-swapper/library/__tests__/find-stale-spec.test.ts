import { mkdtempSync, mkdirSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { findStaleSpec } from '../find-stale-spec.js';

function project({ specAge, generatedAge }) {
  const root = mkdtempSync(join(tmpdir(), 'spec-'));
  const specs = join(root, 'specs');
  const generated = join(root, 'generated');

  mkdirSync(specs);
  mkdirSync(generated);

  const spec = join(specs, 'thing.nitro.ts');
  const out = join(generated, 'Thing.kt');

  writeFileSync(spec, 'export interface Thing {}');
  writeFileSync(out, 'class Thing');

  utimesSync(spec, specAge, specAge);
  utimesSync(out, generatedAge, generatedAge);

  return { specs, generated, spec };
}

describe('findStaleSpec', () => {
  it('a spec edited after codegen means the native side is stale', () => {
    const { specs, generated, spec } = project({ specAge: 2000, generatedAge: 1000 });

    expect(findStaleSpec(specs, generated)).toBe(spec);
  });

  it('codegen newer than the spec means the ABI is intact', () => {
    const { specs, generated } = project({ specAge: 1000, generatedAge: 2000 });

    expect(findStaleSpec(specs, generated)).toBeUndefined();
  });

  it('a project without specs is not a Nitro module and is left alone', () => {
    expect(findStaleSpec('/nowhere/specs', '/nowhere/generated')).toBeUndefined();
  });
});
