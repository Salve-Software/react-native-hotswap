import { REBUILDABLE } from '../constants/index.js';

const REASONS: Record<number, string> = {
  21: 'class not loaded yet; exercise the code path once, then save again',
  62: 'the new bytecode failed verification',
  63: 'a method was added in a way ART will not take; rebuild',
  66: 'the class hierarchy changed; rebuild',
  67: 'a method was removed, which ART never allows; rebuild',
  70: 'class modifiers changed; rebuild',
  71: 'method modifiers changed, usually a d8 version mismatch; see the README',
  103: 'ART refused the dex; check logcat for FAILURE TO REDEFINE',
};

export function needsGeneration(code: number): boolean {
  return REBUILDABLE.includes(code);
}

export function explainJvmtiError(code: number): string {
  return REASONS[code] ?? `jvmtiError ${code}`;
}
