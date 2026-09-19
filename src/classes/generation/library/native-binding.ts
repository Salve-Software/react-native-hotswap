const MAGIC = 0xcafebabe;
const ACC_NATIVE = 0x0100;
const LOADERS = new Set(['loadLibrary', 'load']);
const SYSTEM = 'java/lang/System';

const UTF8 = 1;
const CLASS = 7;
const METHODREF = 10;
const NAME_AND_TYPE = 12;
const WIDE = new Set([5, 6]);
const SIZES = new Map([
  [3, 4],
  [4, 4],
  [5, 8],
  [6, 8],
  [7, 2],
  [8, 2],
  [9, 4],
  [10, 4],
  [11, 4],
  [12, 4],
  [15, 3],
  [16, 2],
  [17, 4],
  [18, 4],
  [19, 2],
  [20, 2],
]);

interface Entry {
  tag: number;
  text?: string;
  first?: number;
  second?: number;
}

/** The class a compiled file binds a native library from, or nothing when it binds none. */
export function nativeBinding(classFile: Buffer): string | undefined {
  if (classFile.length < 10 || classFile.readUInt32BE(0) !== MAGIC) return undefined;

  const pool: (Entry | undefined)[] = [];
  let at = 10;
  const count = classFile.readUInt16BE(8);

  for (let index = 1; index < count; index++) {
    const tag = classFile.readUInt8(at++);

    if (tag === UTF8) {
      const length = classFile.readUInt16BE(at);
      pool[index] = { tag, text: classFile.toString('utf8', at + 2, at + 2 + length) };
      at += 2 + length;
    } else {
      const width = SIZES.get(tag);
      if (width === undefined) return undefined;

      pool[index] = {
        tag,
        first: width >= 2 ? classFile.readUInt16BE(at) : undefined,
        second: width === 4 ? classFile.readUInt16BE(at + 2) : undefined,
      };
      at += width;
    }

    if (WIDE.has(tag)) index++;
  }

  const name = binaryName(pool, classFile.readUInt16BE(at + 2));
  if (name === undefined) return undefined;

  return declaresNative(classFile, at) || callsSystemLoader(pool) ? name : undefined;
}

function binaryName(pool: (Entry | undefined)[], at: number): string | undefined {
  const entry = pool[at];
  if (entry?.tag !== CLASS || entry.first === undefined) return undefined;

  return pool[entry.first]?.text?.replace(/\//g, '.');
}

/** A `native` method needs its library loaded, and only the first loader may load it. */
function declaresNative(classFile: Buffer, after: number): boolean {
  let at = after + 6;
  at += 2 + classFile.readUInt16BE(at) * 2;

  at = skipMembers(classFile, at);
  const methods = classFile.readUInt16BE(at);
  at += 2;

  for (let index = 0; index < methods; index++) {
    if ((classFile.readUInt16BE(at) & ACC_NATIVE) !== 0) return true;
    at = skipAttributes(classFile, at + 6);
  }

  return false;
}

/** A class can bind a library with no native method of its own, just by loading it. */
function callsSystemLoader(pool: (Entry | undefined)[]): boolean {
  for (const entry of pool) {
    if (
      entry?.tag !== METHODREF ||
      entry.first === undefined ||
      entry.second === undefined
    ) {
      continue;
    }

    const owner = binaryName(pool, entry.first);
    const member = pool[entry.second];
    if (owner !== SYSTEM.replace(/\//g, '.') || member?.tag !== NAME_AND_TYPE) continue;

    const called = member.first === undefined ? undefined : pool[member.first]?.text;
    if (called !== undefined && LOADERS.has(called)) return true;
  }

  return false;
}

function skipMembers(classFile: Buffer, from: number): number {
  const total = classFile.readUInt16BE(from);
  let at = from + 2;

  for (let index = 0; index < total; index++) at = skipAttributes(classFile, at + 6);

  return at;
}

function skipAttributes(classFile: Buffer, from: number): number {
  const total = classFile.readUInt16BE(from);
  let at = from + 2;

  for (let index = 0; index < total; index++) at += 6 + classFile.readUInt32BE(at + 2);

  return at;
}
