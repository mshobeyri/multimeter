/**
 * Per-run process environment store.
 *
 * Workspace / file / CLI env is the source. At run start we copy those values
 * into this store. `e:` reads and `setenv` use only this copy — the source is
 * never mutated by a run. Suite children share one store for the top-level run.
 * Parallel top-level runs each get their own store.
 */
export interface EnvStore {
  values: Record<string, any>;
}

/** Copy `initial` into a new process store (source remains untouched). */
export function createEnvStore(initial?: Record<string, any>): EnvStore {
  return {values: {...(initial || {})}};
}

/** Isolated snapshot for load-test VUs (setenv must not cross VUs). */
export function cloneEnvStore(store?: EnvStore, fallback?: Record<string, any>):
    EnvStore {
  return createEnvStore(store?.values || fallback);
}
