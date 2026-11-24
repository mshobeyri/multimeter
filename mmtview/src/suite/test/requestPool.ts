export type PoolPriority = 'high' | 'low';

export type RequestPool = {
  /**
   * Run `task` when a slot is free. 'high' tasks always start before 'low' ones;
   * within a priority the order is first in, first out.
   */
  run: <T>(task: () => Promise<T>, priority?: PoolPriority) => Promise<T>;
  /** Number of tasks currently running. */
  active: () => number;
  /** Number of tasks waiting for a slot. */
  waiting: () => number;
};

/**
 * Limits how many async tasks run at once, so opening a big suite does not send
 * hundreds of hierarchy requests to the extension host in one burst.
 * A task that throws or rejects frees its slot like any other.
 */
export function createRequestPool(maxConcurrent: number): RequestPool {
  const limit = Math.max(1, Math.floor(maxConcurrent) || 1);
  const high: Array<() => void> = [];
  const low: Array<() => void> = [];
  let running = 0;

  const pump = (): void => {
    while (running < limit) {
      const start = high.shift() || low.shift();
      if (!start) {
        return;
      }
      running += 1;
      start();
    }
  };

  const run = <T>(task: () => Promise<T>, priority: PoolPriority = 'high'): Promise<T> => {
    return new Promise<T>((resolve, reject) => {
      const start = (): void => {
        const release = (): void => {
          running -= 1;
          pump();
        };
        let result: Promise<T>;
        try {
          result = Promise.resolve(task());
        } catch (error) {
          result = Promise.reject(error);
        }
        result.then(
          (value) => {
            release();
            resolve(value);
          },
          (error) => {
            release();
            reject(error);
          },
        );
      };
      (priority === 'high' ? high : low).push(start);
      pump();
    });
  };

  return {
    run,
    active: () => running,
    waiting: () => high.length + low.length,
  };
}
