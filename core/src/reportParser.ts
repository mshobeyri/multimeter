import type { CollectedResults, TestStepResult, TestRunResult, SuiteRunResult } from './reportCollector';

/**
 * Parse a `type: report` YAML object (already parsed from YAML string)
 * back into `CollectedResults`. This is the inverse of `generateMmtReport`.
 */
export function parseReportMmt(doc: Record<string, any>): CollectedResults {
  if (!doc || doc.type !== 'report') {
    throw new Error('Not a valid MMT report: missing or incorrect "type" field');
  }

  const suites: any[] = Array.isArray(doc.suites) ? doc.suites : [];
  const testRuns: TestRunResult[] = suites.map((suite, i) => parseSuiteEntry(suite, i));

  const hasSuiteMeta = doc.timestamp != null || doc.duration != null || suites.length > 1;

  if (hasSuiteMeta || suites.length > 1) {
    const suiteRun: SuiteRunResult = {
      runId: 'report',
      suitePath: doc.name,
      startedAt: doc.timestamp ? new Date(doc.timestamp).getTime() : 0,
      durationMs: parseDurationMs(doc.duration),
      success: doc.summary ? doc.summary.failed === 0 : testRuns.every(r => r.result === 'passed'),
      cancelled: doc.cancelled === true ? true : undefined,
      totalRunnable: testRuns.length,
      testRuns,
    };
    return { type: 'suite', suiteRun, testRuns };
  }

  return { type: 'test', testRuns };
}

function parseSuiteEntry(suite: any, index: number): TestRunResult {
  const tests: any[] = Array.isArray(suite.tests) ? suite.tests : [];
  const steps: TestStepResult[] = tests.map((t, i) => parseTestEntry(t, i));
  const hasFailed = steps.some(s => s.status === 'failed');

  return {
    runId: `run-${index}`,
    filePath: suite.file,
    displayName: suite.name || `test-${index}`,
    result: suite.result || (hasFailed ? 'failed' : 'passed'),
    durationMs: parseDurationMs(suite.duration),
    steps,
  };
}

function parseTestEntry(test: any, index: number): TestStepResult {
  const step: TestStepResult = {
    stepIndex: index,
    stepType: test.type === 'assert' ? 'assert' : 'check',
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
