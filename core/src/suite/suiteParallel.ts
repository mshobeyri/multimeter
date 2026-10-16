/**
 * Suite item concurrency: adaptive default is CPU cores × 4 (network-bound).
 * Hosts (CLI / extension) supply cpuCount; core stays platform-neutral.
 */

/** Used when the host cannot read a positive CPU count. */
export const FALLBACK_SUITE_PARALLEL = 8;

export function defaultSuiteParallel(cpuCount: number|undefined|null): number {
  if (typeof cpuCount !== 'number' || !Number.isFinite(cpuCount) || cpuCount < 1) {
    return FALLBACK_SUITE_PARALLEL;
  }
  return Math.floor(cpuCount) * 4;
}

/**
 * Resolve suite parallel limit from a host CPU-count getter.
 * Any throw / non-positive result falls back to {@link FALLBACK_SUITE_PARALLEL}.
 */
export function resolveHostSuiteParallel(getCpuCount: () => number): number {
  try {
    return defaultSuiteParallel(getCpuCount());
  } catch {
    return FALLBACK_SUITE_PARALLEL;
  }
}

export type SuiteParallelGate = {
  readonly limit: number;
  acquire: () => Promise<void>;
  release: () => void;
};

/** Run-wide semaphore limiting in-flight suite test/api items. */
export function createSuiteParallelGate(limit: number): SuiteParallelGate {
  const max = Math.max(1, Math.floor(limit));
  let active = 0;
  const waiters: Array<() => void> = [];

  return {
    limit: max,
    acquire: () => new Promise<void>((resolve) => {
      if (active < max) {
        active += 1;
        resolve();
        return;
      }
      waiters.push(() => {
        active += 1;
        resolve();
      });
    }),
    release: () => {
      active = Math.max(0, active - 1);
      const next = waiters.shift();
      if (next) {
        next();
      }
    },
  };
}
