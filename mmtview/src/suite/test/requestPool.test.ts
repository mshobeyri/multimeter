import { createRequestPool } from './requestPool';

function deferred<T = void>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('createRequestPool', () => {
  it('never runs more than the limit at once', async () => {
    const pool = createRequestPool(3);
    let running = 0;
    let peak = 0;
    const gates = Array.from({ length: 10 }, () => deferred());

    const results = gates.map((gate, index) => pool.run(async () => {
      running += 1;
      peak = Math.max(peak, running);
      await gate.promise;
      running -= 1;
      return index;
    }));

    await flush();
    expect(pool.active()).toBe(3);
    expect(pool.waiting()).toBe(7);

    for (const gate of gates) {
      gate.resolve();
      await flush();
    }

    expect(await Promise.all(results)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(peak).toBe(3);
    expect(pool.active()).toBe(0);
    expect(pool.waiting()).toBe(0);
  });

  it('starts high priority tasks before queued low priority ones', async () => {
    const pool = createRequestPool(1);
    const order: string[] = [];
    const first = deferred();

    const running = pool.run(async () => {
      order.push('first');
      await first.promise;
    });
    const low = pool.run(async () => { order.push('low'); }, 'low');
    const high = pool.run(async () => { order.push('high'); }, 'high');

    first.resolve();
    await Promise.all([running, low, high]);

    expect(order).toEqual(['first', 'high', 'low']);
  });

  it('frees the slot when a task rejects or throws', async () => {
    const pool = createRequestPool(1);

    const failing = pool.run(async () => {
      throw new Error('boom');
    });
    const throwing = pool.run((() => {
      throw new Error('sync boom');
    }) as () => Promise<never>);
    const after = pool.run(async () => 'ok');

    await expect(failing).rejects.toThrow('boom');
    await expect(throwing).rejects.toThrow('sync boom');
    await expect(after).resolves.toBe('ok');
    expect(pool.active()).toBe(0);
  });

  it('treats a non-positive limit as one at a time', async () => {
    const pool = createRequestPool(0);
    const gate = deferred();
    const started: number[] = [];

    const a = pool.run(async () => { started.push(1); await gate.promise; });
    const b = pool.run(async () => { started.push(2); });

    await flush();
    expect(started).toEqual([1]);

    gate.resolve();
    await Promise.all([a, b]);
    expect(started).toEqual([1, 2]);
  });
});
