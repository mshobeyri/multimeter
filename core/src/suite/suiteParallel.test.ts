import {
  createSuiteParallelGate,
  defaultSuiteParallel,
  FALLBACK_SUITE_PARALLEL,
  resolveHostSuiteParallel,
} from './suiteParallel';

describe('defaultSuiteParallel', () => {
  it('returns cores × 4', () => {
    expect(defaultSuiteParallel(1)).toBe(4);
    expect(defaultSuiteParallel(2)).toBe(8);
    expect(defaultSuiteParallel(8)).toBe(32);
  });

  it('floors fractional core counts', () => {
    expect(defaultSuiteParallel(2.9)).toBe(8);
  });

  it('uses FALLBACK_SUITE_PARALLEL when cores are missing or invalid', () => {
    expect(defaultSuiteParallel(undefined)).toBe(FALLBACK_SUITE_PARALLEL);
    expect(defaultSuiteParallel(null)).toBe(FALLBACK_SUITE_PARALLEL);
    expect(defaultSuiteParallel(0)).toBe(FALLBACK_SUITE_PARALLEL);
    expect(defaultSuiteParallel(-3)).toBe(FALLBACK_SUITE_PARALLEL);
    expect(defaultSuiteParallel(Number.NaN)).toBe(FALLBACK_SUITE_PARALLEL);
    expect(FALLBACK_SUITE_PARALLEL).toBe(8);
  });
});

describe('resolveHostSuiteParallel', () => {
  it('uses the getter result when valid', () => {
    expect(resolveHostSuiteParallel(() => 4)).toBe(16);
  });

  it('falls back when the getter throws or returns a bad count', () => {
    expect(resolveHostSuiteParallel(() => {
      throw new Error('no cpus');
    })).toBe(FALLBACK_SUITE_PARALLEL);
    expect(resolveHostSuiteParallel(() => 0)).toBe(FALLBACK_SUITE_PARALLEL);
  });
});

describe('createSuiteParallelGate', () => {
  it('never allows more than limit concurrent holders', async () => {
    const gate = createSuiteParallelGate(2);
    let inFlight = 0;
    let peak = 0;

    const worker = async () => {
      await gate.acquire();
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 20));
      inFlight -= 1;
      gate.release();
    };

    await Promise.all(Array.from({length: 8}, () => worker()));
    expect(peak).toBe(2);
    expect(inFlight).toBe(0);
  });

  it('treats limit below 1 as 1', async () => {
    const gate = createSuiteParallelGate(0);
    expect(gate.limit).toBe(1);
    await gate.acquire();
    gate.release();
  });
});
