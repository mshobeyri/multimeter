import { createSuiteRunDataStore } from './suiteRunDataStore';
import { computeReportStats } from '../../shared/reportSpillLogic';
import type { StepReportItem } from '../../shared/TestStepReportPanel';

const sampleReport = (status: 'passed' | 'failed' = 'passed'): StepReportItem => ({
  stepIndex: 1,
  stepType: 'check',
  status,
  title: 'step',
  details: 'details',
  expects: [],
  timestamp: 1,
});

describe('suiteRunDataStore', () => {
  it('increments overview counts when reports are appended', () => {
    const store = createSuiteRunDataStore();
    store.appendReports({
      'suite-node:0': [sampleReport('passed'), sampleReport('failed')],
    });

    expect(store.getOverview()).toMatchObject({
      passed: 1,
      failed: 1,
      fileCount: 1,
      hasReportData: true,
      hasRunState: false,
    });
  });

  it('tracks run state without requiring a full overview rescan each flush', () => {
    const store = createSuiteRunDataStore();
    store.patchRunState({
      'suite-node:0': 'running',
      'suite-node:1': 'skipped',
    });

    expect(store.getOverview()).toMatchObject({
      skipped: 1,
      hasRunState: true,
    });
  });

  it('counts skipped parents once when descendants are also marked skipped', () => {
    const store = createSuiteRunDataStore();
    store.patchRunState({
      'suite-node:0': 'skipped',
      'suite-node:0.0': 'skipped',
      'suite-node:0.1': 'skipped',
      'suite-node:1': 'skipped',
    });

    expect(store.getOverview()).toMatchObject({
      skipped: 2,
    });
  });

  it('counts nested skipped ids once per top skipped ancestor, with unrelated prefixes ignored', () => {
    const store = createSuiteRunDataStore();
    store.patchRunState({
      'suite-node:0': 'skipped',
      'suite-node:0.1.2': 'skipped',
      'suite-node:1.0': 'skipped',
      'suite-node:1.0.5': 'skipped',
      'suite-node:10': 'skipped',
      'suite-node:11.0': 'skipped',
    });

    // 0 (covers 0.1.2), 1.0 (covers 1.0.5), 10, 11.0. "suite-node:1" is not a skipped ancestor of 10.
    expect(store.getOverview().skipped).toBe(4);
  });

  it('keeps run-state updates fast with thousands of skipped nodes', () => {
    const store = createSuiteRunDataStore();
    const skipped: Record<string, 'skipped'> = {};
    for (let i = 0; i < 5000; i++) {
      skipped[`suite-node:0.${i}`] = 'skipped';
    }
    store.patchRunState(skipped);

    const startedAt = Date.now();
    for (let i = 0; i < 100; i++) {
      store.patchRunState({ [`suite-node:1.${i}`]: 'running' });
    }

    // Was ~40s with the all-pairs comparison; ~0.3s now. Generous bound avoids flakiness.
    expect(Date.now() - startedAt).toBeLessThan(5000);
    expect(store.getOverview().skipped).toBe(5000);
  });

  it('resets overview and tree data together', () => {
    const store = createSuiteRunDataStore();
    store.appendReports({ 'suite-node:0': [sampleReport()] });
    store.patchRunState({ 'suite-node:0': 'passed' });

    store.resetAll();

    expect(store.getOverview()).toEqual({
      passed: 0,
      failed: 0,
      skipped: 0,
      fileCount: 0,
      hasReportData: false,
      hasRunState: false,
    });
    expect(store.getReportsById()).toEqual({});
    expect(store.getRunStateById()).toEqual({});
  });

  describe('stale spill results', () => {
    const spillOf = (id: string, reports: StepReportItem[]) => ({
      spilled: new Set([id]),
      stats: { [id]: computeReportStats(reports) },
    });

    it('does not bring old pass counts back after a new run reset the store', () => {
      const store = createSuiteRunDataStore();
      const previousRun = [sampleReport(), sampleReport(), sampleReport()];
      store.appendReports({ 'suite-node:0': previousRun });

      // Previous run: a spill starts (async) ...
      const epoch = store.getResetEpoch();
      const spill = spillOf('suite-node:0', previousRun);

      // ... user clicks Run again before it finishes.
      store.resetReportsAndSpill();
      store.patchRunState({ 'suite-node:0': 'running' });
      expect(store.getOverview().passed).toBe(0);

      // The old spill completes late: it must be ignored.
      expect(store.applySpill(spill.spilled, spill.stats, ['suite-node:0'], epoch)).toBe(false);
      store.patchRunState({ 'suite-node:0': 'passed' });

      expect(store.getOverview()).toMatchObject({ passed: 0, failed: 0, fileCount: 0 });
      expect(store.getSpilledReportIds().size).toBe(0);
    });

    it('applies a spill when nothing was reset in the meantime', () => {
      const store = createSuiteRunDataStore();
      const reports = [sampleReport(), sampleReport('failed')];
      store.appendReports({ 'suite-node:0': reports });
      const epoch = store.getResetEpoch();
      const spill = spillOf('suite-node:0', reports);

      expect(store.applySpill(spill.spilled, spill.stats, ['suite-node:0'], epoch)).toBe(true);
      store.patchRunState({ 'suite-node:0': 'failed' });

      expect(store.getSpilledReportIds().has('suite-node:0')).toBe(true);
      expect(store.getOverview()).toMatchObject({ passed: 1, failed: 1, fileCount: 1 });
    });

    it('ignores a stale spill after a partial run reset too', () => {
      const store = createSuiteRunDataStore();
      store.appendReports({ 'suite-node:0': [sampleReport()] });
      const epoch = store.getResetEpoch();
      const spill = spillOf('suite-node:0', [sampleReport()]);

      store.resetPartial(['suite-node:0']);

      expect(store.applySpill(spill.spilled, spill.stats, ['suite-node:0'], epoch)).toBe(false);
    });
  });
});
