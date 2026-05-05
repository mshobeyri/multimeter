import type { CollectedResults, TestStepResult, TestRunResult, SuiteRunResult } from './reportCollector';

/**
 * Parse a `type: report` YAML object (already parsed from YAML string)
 * back into `CollectedResults`. This is the inverse of `generateMmtReport`.
 */
export function parseReportMmt(doc: Record<string, any>): CollectedResults {
  if (!doc || doc.type !== 'report') {
    throw new Error('Not a valid MMT report: missing or incorrect "type" field');
  }

  const checkEntries: any[] = Array.isArray(doc.checks) ? doc.checks : (Array.isArray(doc.suites) ? doc.suites : []);
  const testRuns: TestRunResult[] = checkEntries.map((suite, i) => parseSuiteEntry(suite, i));
  const load = doc.kind === 'load' ? parseLoadData(doc) : undefined;
  const overview = doc.overview && typeof doc.overview === 'object' ? doc.overview : (doc.summary || {});

  const hasSuiteMeta = overview.timestamp != null || doc.timestamp != null || overview.duration != null || doc.duration != null || checkEntries.length > 1;

  if (hasSuiteMeta || checkEntries.length > 1) {
    const suiteRun: SuiteRunResult = {
      runId: 'report',
      suitePath: doc.name,
      startedAt: overview.timestamp ? new Date(overview.timestamp).getTime() : doc.timestamp ? new Date(doc.timestamp).getTime() : 0,
      durationMs: parseDurationMs(overview.duration ?? doc.duration),
      success: overview ? (overview.failed || overview.failures || 0) === 0 : testRuns.every(r => r.result === 'passed'),
      cancelled: doc.cancelled === true ? true : undefined,
      totalRunnable: testRuns.length,
      testRuns,
    };
    return { type: doc.kind === 'load' ? 'loadtest' : 'suite', suiteRun, testRuns, load };
  }

  return { type: doc.kind === 'load' ? 'loadtest' : 'test', testRuns, load };
}

function parseSuiteEntry(suite: any, index: number): TestRunResult {
  const tests: any[] = Array.isArray(suite.checks) ? suite.checks : (Array.isArray(suite.tests) ? suite.tests : []);
  const steps: TestStepResult[] = tests.map((t, i) => parseTestEntry(t, i));
  const hasFailed = steps.some(s => s.status === 'failed');

  return {
    runId: `run-${index}`,
    filePath: suite.file,
    displayName: suite.name || `test-${index}`,
    docType: suite.type === 'suite' ? 'suite' : suite.type === 'test' ? 'test' : undefined,
    result: suite.result || (hasFailed ? 'failed' : 'passed'),
    durationMs: parseDurationMs(suite.duration),
    steps,
  };
}

function parseTestEntry(test: any, index: number): TestStepResult {
  const step: TestStepResult = {
    stepIndex: index,
    stepType: test.step === 'assert' || test.type === 'assert' ? 'assert' : test.step === 'debug' ? 'debug' : 'check',
    status: test.result === 'failed' ? 'failed' : 'passed',
    expects: [],
    timestamp: 0,
    durationMs: parseDurationMs(test.duration),
    title: test.name,
  };

  if (Array.isArray(test.expects)) {
    step.expects = test.expects.map((e: any) => ({
      comparison: typeof e.comparison === 'string' ? e.comparison : '',
      actual: e.actual,
      expected: e.expected,
      status: e.result === 'failed' ? 'failed' as const : 'passed' as const,
    }));
  } else if (test.failure) {
    // Legacy format without expects array — build a single-item expects
    step.expects = [{
      comparison: test.failure.operator || '',
      actual: test.failure.actual,
      expected: test.failure.expected,
      status: 'failed' as const,
    }];
  }

  return step;
}

function parseLoadData(doc: Record<string, any>): CollectedResults['load'] {
  if (doc.load && typeof doc.load === 'object') {
    return doc.load;
  }
  const overview = doc.overview && typeof doc.overview === 'object' ? doc.overview : doc.summary;
  const load: NonNullable<CollectedResults['load']> = {};
  if (doc.tool) { load.tool = doc.tool; }
  if (doc.scenario) { load.scenario = doc.scenario; }
  if (doc.test) { load.test = doc.test; }
  if (doc.config) { load.config = doc.config; }
  if (overview) { load.summary = overview; }
  if (doc.latency) { load.latency = doc.latency; }
  if (doc.http) { load.http = doc.http; }
  if (doc.thresholds) { load.thresholds = doc.thresholds; }
  if (doc.errors) { load.errors = doc.errors; }
  if (Array.isArray(doc.snapshots)) {
    load.snapshots = doc.snapshots;
    const startValue = overview?.timestamp || doc.timestamp;
    const start = startValue ? new Date(startValue).getTime() : undefined;
    load.series = doc.snapshots.map((snapshot: any) => {
      const at = Number(snapshot.at || 0);
      const timestamp = start && Number.isFinite(at) ? new Date(start + at * 1000).toISOString() : String(snapshot.at || '');
      return {timestamp, ...snapshot};
    });
  }
  return load;
}

function parseDurationMs(duration: any): number | undefined {
  if (duration == null) {
    return undefined;
  }
  const str = String(duration);
  if (str.endsWith('s')) {
    const seconds = parseFloat(str.slice(0, -1));
    if (!isNaN(seconds)) {
      return Math.round(seconds * 1000);
    }
  }
  const num = parseFloat(str);
  if (!isNaN(num)) {
    return Math.round(num * 1000);
  }
  return undefined;
}
