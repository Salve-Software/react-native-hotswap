import { describe, expect, it } from 'vitest';
import { serialize } from '../serialize.js';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

describe('serialize', () => {
  it('a slow task finishes before the next one starts', async () => {
    const queue = serialize();
    const order = [];

    const first = queue(async () => {
      await wait(20);
      order.push('first');
    });
    const second = queue(async () => {
      order.push('second');
    });

    await Promise.all([first, second]);

    expect(order).toEqual(['first', 'second']);
  });

  it('a task that throws does not stall the queue', async () => {
    const queue = serialize();
    const order = [];

    queue(async () => {
      throw new Error('boom');
    }).catch(() => undefined);
    await queue(async () => {
      order.push('ran anyway');
    });

    expect(order).toEqual(['ran anyway']);
  });
});
