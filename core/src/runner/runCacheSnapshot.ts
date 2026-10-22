import {listLiveEnvCacheEntries} from '../env/envStore';
import {
  listTestCallCacheEntries_,
  type TestCallCacheSnapshot,
} from './testHelper';
import type {LiveEnvCacheSnapshot} from '../env/envStore';

export type RunCacheEntry = TestCallCacheSnapshot|LiveEnvCacheSnapshot;

/**
 * Combined read-only view of in-run caches for the Cache panel.
 * Empties when the underlying stores clear (same keep policy as today).
 */
export function listRunCacheEntries(): RunCacheEntry[] {
  const testCalls = listTestCallCacheEntries_();
  const liveEnv = listLiveEnvCacheEntries();
  return [...testCalls, ...liveEnv].sort(
      (a, b) => a.remainingMs - b.remainingMs);
}
