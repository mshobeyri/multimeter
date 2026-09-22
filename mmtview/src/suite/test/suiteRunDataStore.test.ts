import { createSuiteRunDataStore } from './suiteRunDataStore';
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
});
