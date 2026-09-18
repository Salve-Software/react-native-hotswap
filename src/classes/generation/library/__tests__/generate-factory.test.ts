import { describe, expect, it } from 'vitest';
import { generateFactory } from '../generate-factory.js';

describe('generateFactory', () => {
  it('an exposed class becomes a case, since nothing may look it up by name', () => {
    const out = generateFactory(['@objc public class ProbeValues: NSObject {}']);

    expect(out).toContain('case "ProbeValues": return unsafeBitCast(ProbeValues.self');
  });

  it('a class that is not exposed to the runtime is left out', () => {
    expect(generateFactory(['class Internal {}'])).not.toContain('Internal');
  });

  it('the objc name in parentheses does not hide the declaration', () => {
    expect(generateFactory(['@objc(RCTProbe) class Probe: NSObject {}'])).toContain(
      'Probe.self',
    );
  });

  it('final and access modifiers do not hide it either', () => {
    expect(generateFactory(['@objc public final class Probe: NSObject {}'])).toContain(
      'Probe.self',
    );
  });

  it('a class declared in two files is emitted once, or the switch will not compile', () => {
    const out = generateFactory([
      '@objc class Probe: NSObject {}',
      '@objc class Probe: NSObject {}',
    ]);

    expect(out.match(/case "Probe"/g)).toHaveLength(1);
  });

  it('a module with nothing exposed still compiles, returning nothing', () => {
    const out = generateFactory(['struct Plain {}']);

    expect(out).toContain('default: return nil');
    expect(out).toContain('@_cdecl("hotswapClassNamed")');
  });
});
