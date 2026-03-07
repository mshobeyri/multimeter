import type {
  RunReporterMessage,
  TestStepReporterEvent,
  TestRunSummaryEvent,
  SuiteReporterMessage,
  SuiteRunStartEvent,
  SuiteRunFinishedEvent,
  TestOutputsReporterEvent,
} from './runConfig';

export interface TestStepResult {
  stepIndex: number;
  stepType: 'check' | 'assert';
  status: 'passed' | 'failed';
  comparison: string;
  title?: string;
  details?: string;
  actual?: any;
  expected?: any;
  timestamp: number;
  durationMs?: number;
}

export interface TestRunResult {
  runId: string;
  id?: string;
  filePath?: string;
  displayName?: string;
  result: 'passed' | 'failed';
  durationMs?: number;
  steps: TestStepResult[];
  outputs?: Record<string, any>;
}

export interface SuiteRunResult {
  runId: string;
  suitePath?: string;
  startedAt: number;
  finishedAt?: number;
  durationMs?: number;
  success: boolean;
  cancelled?: boolean;
  totalRunnable: number;
  testRuns: TestRunResult[];
}

export interface CollectedResults {
  type: 'test' | 'suite';
  suiteRun?: SuiteRunResult;
  testRuns: TestRunResult[];
}

function getEventKey(event: {id?: string; runId?: string}): string | undefined {
  return event.id ?? event.runId;
}

export function createReportCollector() {
  const testRunsByKey = new Map<string, TestRunResult>();
  let suiteRun: SuiteRunResult | undefined;
  let hasSuiteEvents = false;

  function getOrCreateTestRun(key: string, runId: string): TestRunResult {
    let run = testRunsByKey.get(key);
    if (!run) {
      run = {
        runId,
        id: key !== runId ? key : undefined,
        result: 'passed',
        steps: [],
      };
      testRunsByKey.set(key, run);
    }
    return run;
  }

  function reporter(message: RunReporterMessage): void {
    if (!message || typeof message !== 'object') {
      return;
    }

    const scope = (message as any).scope;

    if (scope === 'suite-run-start') {
      const event = message as SuiteRunStartEvent;
      hasSuiteEvents = true;
      suiteRun = {
        runId: event.runId,
        suitePath: event.suitePath,
        startedAt: event.startedAt,
        success: true,
        totalRunnable: event.totalRunnable,
        testRuns: [],
      };
      return;
    }

    if (scope === 'suite-run-finished') {
      const event = message as SuiteRunFinishedEvent;
      hasSuiteEvents = true;
      if (suiteRun) {
        suiteRun.finishedAt = event.finishedAt;
        suiteRun.durationMs = event.durationMs;
        suiteRun.success = event.success;
        suiteRun.cancelled = event.cancelled;
      }
      return;
    }

    if (scope === 'suite-item') {
      const event = message as SuiteReporterMessage;
      hasSuiteEvents = true;
      const key = getEventKey({id: event.id, runId: event.runId});
      if (!key) {
        return;
      }
      if (event.status === 'running') {
        const run = getOrCreateTestRun(key, event.runId || key);
        run.filePath = event.filePath;
        run.displayName = event.entry;
      } else if (event.status === 'passed' || event.status === 'failed') {
        const run = testRunsByKey.get(key);
        if (run) {
          run.result = event.status;
        }
      }
      return;
    }

    if (scope === 'test-step') {
      const event = message as TestStepReporterEvent;
      const key = getEventKey(event);
      if (!key) {
        return;
      }
      const run = getOrCreateTestRun(key, event.runId);
      run.steps.push({
        stepIndex: event.stepIndex,
        stepType: event.stepType,
        status: event.status,
        comparison: event.comparison,
        title: event.title,
        details: event.details,
        actual: event.actual,
        expected: event.expected,
        timestamp: event.timestamp,
      });
      return;
    }

    if (scope === 'test-step-run') {
      const event = message as TestRunSummaryEvent;
      const key = getEventKey(event);
      if (!key) {
        return;
      }
      const run = testRunsByKey.get(key);
      if (run) {
        run.result = event.result;
      }
      return;
    }

    if (scope === 'test-outputs') {
      const event = message as TestOutputsReporterEvent;
      const key = getEventKey(event);
      if (!key) {
        return;
      }
      const run = testRunsByKey.get(key);
      if (run) {
        run.outputs = event.outputs;
      }
      return;
    }
  }

  function getResults(): CollectedResults {
    const allRuns = Array.from(testRunsByKey.values());

    if (hasSuiteEvents && suiteRun) {
      suiteRun.testRuns = allRuns;
      return {
        type: 'suite',
        suiteRun,
        testRuns: allRuns,
      };
    }

    return {
      type: 'test',
      testRuns: allRuns,
    };
  }

  return {reporter, getResults};
}
