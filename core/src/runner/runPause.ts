/**
 * Cooperative pause gate for test/suite runs. Checked at the same step
 * boundaries as abort (`await checkAbort_()`); resume continues the same run.
 */
export interface RunPauseGate {
  readonly paused: boolean;
  pause(): void;
  resume(): void;
  waitIfPaused(): Promise<void>;
}

/** Create a pause gate; abort wakes waiters so Stop still works while paused. */
export function createRunPauseGate(abortSignal?: AbortSignal): RunPauseGate {
  let paused = false;
  const waiters: Array<() => void> = [];
  const wake = () => {
    const pending = waiters.splice(0, waiters.length);
    for (const resolve of pending) {
      resolve();
    }
  };
  if (abortSignal) {
    abortSignal.addEventListener('abort', () => {
      wake();
    }, {once: true});
  }
  return {
    get paused() {
      return paused;
    },
    pause() {
      paused = true;
    },
    resume() {
      if (!paused) {
        return;
      }
      paused = false;
      wake();
    },
    async waitIfPaused() {
      while (paused && !abortSignal?.aborted) {
        await new Promise<void>(resolve => {
          waiters.push(resolve);
        });
      }
    },
  };
}
