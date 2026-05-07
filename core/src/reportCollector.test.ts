import {createReportCollector} from './reportCollector';
import type {
  RunReporterMessage,
  TestStepReporterEvent,
  TestRunSummaryEvent,
  SuiteReporterMessage,
  SuiteRunStartEvent,
  SuiteRunFinishedEvent,
  TestOutputsReporterEvent,
} from './runConfig';

describe('reportCollector', () => {
  it('accumulates test-step events into a TestRunResult', () => {
    const {reporter, getResults} = createReportCollector();
    const step: TestStepReporterEvent = {
      scope: 'test-step',
      runId: 'run1',
      stepIndex: 0,
      stepType: 'check',
      status: 'passed',
      expects: [{ comparison: 'status == 200', status: 'passed' }],
      title: 'status check',
      timestamp: 1000,
    };
    reporter(step);
    const results = getResults();
    expect(results.type).toBe('test');
    expect(results.testRuns).toHaveLength(1);
    expect(results.testRuns[0].runId).toBe('run1');
    expect(results.testRuns[0].steps).toHaveLength(1);
    expect(results.testRuns[0].steps[0].status).toBe('passed');
    expect(results.testRuns[0].steps[0].expects[0].comparison).toBe('status == 200');
  });

  it('accumulates multiple steps into one test run', () => {
    const {reporter, getResults} = createReportCollector();
    reporter({
      scope: 'test-step',
      runId: 'run1',
      stepIndex: 0,
      stepType: 'check',
      status: 'passed',
      expects: [{ comparison: 'status == 200', status: 'passed' }],
      timestamp: 1000,
    } as TestStepReporterEvent);
    reporter({
      scope: 'test-step',
      runId: 'run1',
      stepIndex: 1,
      stepType: 'assert',
      status: 'failed',
      expects: [{ comparison: 'result.name == John', actual: 'Jane', expected: 'John', status: 'failed' }],
      timestamp: 1100,
    } as TestStepReporterEvent);
    const results = getResults();
    expect(results.testRuns).toHaveLength(1);
    expect(results.testRuns[0].steps).toHaveLength(2);
    expect(results.testRuns[0].steps[1].status).toBe('failed');
    expect(results.testRuns[0].steps[1].expects[0].actual).toBe('Jane');
  });

  it('matches events by id when available, falling back to runId', () => {
    const {reporter, getResults} = createReportCollector();
    reporter({
      scope: 'test-step',
      runId: 'run1',
      id: 'node-a',
      stepIndex: 0,
      stepType: 'check',
      status: 'passed',
      expects: [{ comparison: 'x == 1', status: 'passed' }],
      timestamp: 1000,
    } as TestStepReporterEvent);
    reporter({
      scope: 'test-step',
      runId: 'run2',
      id: 'node-a',
      stepIndex: 1,
      stepType: 'check',
      status: 'passed',
      expects: [{ comparison: 'y == 2', status: 'passed' }],
      timestamp: 1100,
    } as TestStepReporterEvent);
    const results = getResults();
    // Both steps should be under the same test run keyed by 'node-a'
    expect(results.testRuns).toHaveLength(1);
    expect(results.testRuns[0].steps).toHaveLength(2);
    expect(results.testRuns[0].id).toBe('node-a');
  });

  it('sets result from test-step-run event', () => {
    const {reporter, getResults} = createReportCollector();
    reporter({
      scope: 'test-step',
      runId: 'run1',
      stepIndex: 0,
      stepType: 'check',
      status: 'passed',
      expects: [{ comparison: 'a == b', status: 'passed' }],
      timestamp: 1000,
    } as TestStepReporterEvent);
    reporter({
      scope: 'test-step-run',
      runId: 'run1',
      result: 'failed',
    } as TestRunSummaryEvent);
    const results = getResults();
    expect(results.testRuns[0].result).toBe('failed');
  });

  it('attaches outputs from test-outputs event', () => {
    const {reporter, getResults} = createReportCollector();
    reporter({
      scope: 'test-step',
      runId: 'run1',
      stepIndex: 0,
      stepType: 'check',
      status: 'passed',
      expects: [{ comparison: 'a == b', status: 'passed' }],
      timestamp: 1000,
    } as TestStepReporterEvent);
    reporter({
      scope: 'test-outputs',
      runId: 'run1',
      outputs: {token: 'abc123'},
    } as TestOutputsReporterEvent);
    const results = getResults();
    expect(results.testRuns[0].outputs).toEqual({token: 'abc123'});
  });

  it('collects suite lifecycle events', () => {
    const {reporter, getResults} = createReportCollector();
    reporter({
      scope: 'suite-run-start',
      runId: 'suite1',
      suitePath: '/path/to/suite.mmt',
      startedAt: 1000,
      totalRunnable: 3,
    } as SuiteRunStartEvent);

    reporter({
      scope: 'suite-item',
      id: 'node-a',
      runId: 'run1',
      status: 'running',
      filePath: '/path/to/test1.mmt',
      entry: 'test1.mmt',
    } as SuiteReporterMessage);

    reporter({
      scope: 'test-step',
      runId: 'run1',
      id: 'node-a',
      stepIndex: 0,
      stepType: 'check',
      status: 'passed',
      expects: [{ comparison: 's == 200', status: 'passed' }],
      timestamp: 1100,
    } as TestStepReporterEvent);

    reporter({
      scope: 'suite-item',
      id: 'node-a',
      runId: 'run1',
      status: 'passed',
    } as SuiteReporterMessage);

    reporter({
      scope: 'suite-run-finished',
      runId: 'suite1',
      suitePath: '/path/to/suite.mmt',
      finishedAt: 2000,
      success: true,
      durationMs: 1000,
    } as SuiteRunFinishedEvent);

    const results = getResults();
    expect(results.type).toBe('suite');
    expect(results.suiteRun).toBeDefined();
    expect(results.suiteRun!.success).toBe(true);
    expect(results.suiteRun!.durationMs).toBe(1000);
    expect(results.suiteRun!.totalRunnable).toBe(3);
    expect(results.suiteRun!.testRuns).toHaveLength(1);
    expect(results.suiteRun!.testRuns[0].filePath).toBe('/path/to/test1.mmt');
    expect(results.suiteRun!.testRuns[0].steps).toHaveLength(1);
  });

  it('handles cancelled suite run', () => {
    const {reporter, getResults} = createReportCollector();
    reporter({
      scope: 'suite-run-start',
      runId: 'suite1',
      startedAt: 1000,
      totalRunnable: 2,
    } as SuiteRunStartEvent);
    reporter({
      scope: 'suite-run-finished',
      runId: 'suite1',
      finishedAt: 1500,
      success: false,
      durationMs: 500,
      cancelled: true,
    } as SuiteRunFinishedEvent);
    const results = getResults();
    expect(results.suiteRun!.cancelled).toBe(true);
    expect(results.suiteRun!.success).toBe(false);
  });

  it('standalone test run (no suite events) returns type test', () => {
    const {reporter, getResults} = createReportCollector();
    reporter({
      scope: 'test-step',
      runId: 'run1',
      stepIndex: 0,
      stepType: 'check',
      status: 'passed',
      expects: [{ comparison: 'ok == true', status: 'passed' }],
      timestamp: 1000,
    } as TestStepReporterEvent);
    reporter({
      scope: 'test-step-run',
      runId: 'run1',
      result: 'passed',
    } as TestRunSummaryEvent);
    const results = getResults();
    expect(results.type).toBe('test');
    expect(results.suiteRun).toBeUndefined();
    expect(results.testRuns).toHaveLength(1);
  });

  it('returns loadtest results when load summary events are reported', () => {
    const {reporter, getResults} = createReportCollector();
    reporter({
      scope: 'suite-run-start',
      runId: 'load1',
      suitePath: '/path/to/load.mmt',
      startedAt: 1000,
      totalRunnable: 1,
    } as SuiteRunStartEvent);
    reporter({
      scope: 'loadtest-summary',
      runId: 'load1',
      load: {
        tool: 'multimeter',
        summary: {iterations: 10, requests: 20, successes: 10, failures: 0},
        series: [],
      },
    } as any);

    const results = getResults();
    expect(results.type).toBe('loadtest');
    expect(results.load?.summary?.requests).toBe(20);
    expect(results.suiteRun?.totalRunnable).toBe(1);
  });

  it('ignores null or non-object messages', () => {
    const {reporter, getResults} = createReportCollector();
    reporter(null as any);
    reporter(undefined as any);
    reporter('string' as any);
    const results = getResults();
    expect(results.testRuns).toHaveLength(0);
  });

  it('ignores setenv events (does not create test runs)', () => {
    const {reporter, getResults} = createReportCollector();
    reporter({
      scope: 'setenv',
      name: 'TOKEN',
      value: 'abc',
      runId: 'run1',
    } as any);
    const results = getResults();
    expect(results.testRuns).toHaveLength(0);
  });

  it('suite-item with filePath/entry sets displayName and filePath', () => {
    const {reporter, getResults} = createReportCollector();
    reporter({
      scope: 'suite-run-start',
      runId: 's1',
      startedAt: 0,
      totalRunnable: 1,
    } as SuiteRunStartEvent);
    reporter({
      scope: 'suite-item',
      id: 'n1',
      runId: 'r1',
      status: 'running',
      filePath: '/a/b.mmt',
      entry: 'b.mmt',
    } as SuiteReporterMessage);
    reporter({
      scope: 'suite-item',
      id: 'n1',
      runId: 'r1',
      status: 'passed',
    } as SuiteReporterMessage);
    reporter({
      scope: 'suite-run-finished',
      runId: 's1',
      finishedAt: 100,
      success: true,
      durationMs: 100,
    } as SuiteRunFinishedEvent);
    const results = getResults();
    expect(results.testRuns[0].filePath).toBe('/a/b.mmt');
    expect(results.testRuns[0].displayName).toBe('b.mmt');
  });

  it('suite-item with title uses title as displayName instead of entry', () => {
    const {reporter, getResults} = createReportCollector();
    reporter({
      scope: 'suite-run-start',
      runId: 's1',
      startedAt: 0,
      totalRunnable: 1,
    } as SuiteRunStartEvent);
    reporter({
      scope: 'suite-item',
      id: 'n1',
      runId: 'r1',
      status: 'running',
      filePath: '/path/to/my-test.mmt',
      entry: 'my-test.mmt',
      title: 'My Custom Test Title',
      docType: 'test',
    } as SuiteReporterMessage);
    reporter({
      scope: 'suite-item',
      id: 'n1',
      runId: 'r1',
      status: 'passed',
    } as SuiteReporterMessage);
    reporter({
      scope: 'suite-run-finished',
      runId: 's1',
      finishedAt: 100,
      success: true,
      durationMs: 100,
    } as SuiteRunFinishedEvent);
    const results = getResults();
    expect(results.testRuns[0].filePath).toBe('/path/to/my-test.mmt');
    expect(results.testRuns[0].displayName).toBe('My Custom Test Title');
    expect(results.testRuns[0].docType).toBe('test');
  });
});
