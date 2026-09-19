import { describe, expect, it } from 'vitest';
import { nativeBinding } from '../native-binding.js';

type Entry =
  { tag: 1; text: string } | { tag: 7 | 10 | 12; first: number; second?: number };

interface ClassFile {
  pool: Entry[];
  thisClass: number;
  methods: number[];
}

function compile({ pool, thisClass, methods }: ClassFile): Buffer {
  const header = Buffer.alloc(10);
  header.writeUInt32BE(0xcafebabe, 0);
  header.writeUInt16BE(pool.length + 1, 8);

  const entries = pool.map((entry) => {
    if (entry.tag === 1) {
      const text = Buffer.from(entry.text, 'utf8');
      const head = Buffer.alloc(3);
      head.writeUInt8(1, 0);
      head.writeUInt16BE(text.length, 1);

      return Buffer.concat([head, text]);
    }

    const width = entry.tag === 7 ? 2 : 4;
    const bytes = Buffer.alloc(1 + width);
    bytes.writeUInt8(entry.tag, 0);
    bytes.writeUInt16BE(entry.first, 1);
    if (width === 4) bytes.writeUInt16BE(entry.second ?? 0, 3);

    return bytes;
  });

  const tail = Buffer.alloc(12 + methods.length * 8);
  tail.writeUInt16BE(0x0021, 0);
  tail.writeUInt16BE(thisClass, 2);
  tail.writeUInt16BE(0, 4);
  tail.writeUInt16BE(0, 6);
  tail.writeUInt16BE(0, 8);
  tail.writeUInt16BE(methods.length, 10);

  methods.forEach((flags, index) => {
    const at = 12 + index * 8;
    tail.writeUInt16BE(flags, at);
    tail.writeUInt16BE(1, at + 2);
    tail.writeUInt16BE(1, at + 4);
    tail.writeUInt16BE(0, at + 6);
  });

  return Buffer.concat([header, ...entries, tail]);
}

const NAMED: Entry[] = [
  { tag: 1, text: 'com/probe/Native' },
  { tag: 7, first: 1 },
];

describe('nativeBinding', () => {
  it('names a class that declares a native method, in binary form', () => {
    const file = compile({ pool: NAMED, thisClass: 2, methods: [0x0101] });

    expect(nativeBinding(file)).toBe('com.probe.Native');
  });

  it('names a class that only calls System.loadLibrary, declaring no native method', () => {
    const file = compile({
      pool: [
        ...NAMED,
        { tag: 1, text: 'java/lang/System' },
        { tag: 7, first: 3 },
        { tag: 1, text: 'loadLibrary' },
        { tag: 1, text: '(Ljava/lang/String;)V' },
        { tag: 12, first: 5, second: 6 },
        { tag: 10, first: 4, second: 7 },
      ],
      thisClass: 2,
      methods: [0x0001],
    });

    expect(nativeBinding(file)).toBe('com.probe.Native');
  });

  it('names a class that calls System.load with a path', () => {
    const file = compile({
      pool: [
        ...NAMED,
        { tag: 1, text: 'java/lang/System' },
        { tag: 7, first: 3 },
        { tag: 1, text: 'load' },
        { tag: 1, text: '(Ljava/lang/String;)V' },
        { tag: 12, first: 5, second: 6 },
        { tag: 10, first: 4, second: 7 },
      ],
      thisClass: 2,
      methods: [0x0001],
    });

    expect(nativeBinding(file)).toBe('com.probe.Native');
  });

  it('leaves a class that binds nothing alone, whatever else it calls', () => {
    const file = compile({
      pool: [
        ...NAMED,
        { tag: 1, text: 'java/lang/String' },
        { tag: 7, first: 3 },
        { tag: 1, text: 'loadLibrary' },
        { tag: 1, text: '()V' },
        { tag: 12, first: 5, second: 6 },
        { tag: 10, first: 4, second: 7 },
      ],
      thisClass: 2,
      methods: [0x0001, 0x0009],
    });

    expect(nativeBinding(file)).toBeUndefined();
  });

  it('finds a native method that is not the first one declared', () => {
    const file = compile({
      pool: NAMED,
      thisClass: 2,
      methods: [0x0001, 0x0009, 0x0101],
    });

    expect(nativeBinding(file)).toBe('com.probe.Native');
  });

  it('refuses anything that is not a class file, rather than reading past the end', () => {
    expect(nativeBinding(Buffer.from('not a class at all'))).toBeUndefined();
    expect(nativeBinding(Buffer.alloc(0))).toBeUndefined();
    expect(nativeBinding(Buffer.from([0xca, 0xfe]))).toBeUndefined();
  });
});
