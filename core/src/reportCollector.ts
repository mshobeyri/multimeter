import type {
  RunReporterMessage,
  TestStepReporterEvent,
  TestRunSummaryEvent,
  SuiteReporterMessage,
  SuiteRunStartEvent,
  SuiteRunFinishedEvent,
  TestOutputsReporterEvent,
  LoadTestSummaryEvent,
} from './runConfig';

export interface ExpectItemResult {
  comparison: string;
  actual?: any;
  expected?: any;
  status: 'passed' | 'failed';
}

export interface TestStepResult {
  stepIndex: number;
  stepType: 'check' | 'assert' | 'debug';
  status: 'passed' | 'failed';
  title?: string;
  details?: string;
  expects: ExpectItemResult[];
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
  suiteTitle?: string;
  startedAt: number;
  finishedAt?: number;
  durationMs?: number;
  success: boolean;
  cancelled?: boolean;
  totalRunnable: number;
  testRuns: TestRunResult[];
}

export interface LoadReportData {
  tool?: string;
  scenario?: string;
  test?: string;
  config?: {
    threads?: number;
    repeat?: string | number;
    rampup?: string;
    started_at?: string;
    finished_at?: string;
  };
  summary?: {
    iterations?: number;
    requests?: number;
    successes?: number;
    failures?: number;
    success_rate?: number;
    failed_rate?: number;
    error_rate?: number;
    throughput?: number;
    data_received?: number;
    data_sent?: number;
  };
  latency?: {
    min?: number;
    avg?: number;
    med?: number;
    max?: number;
    p90?: number;
    p95?: number;
    p99?: number;
  };
  http?: {
    status_codes?: Record<string, number>;
    failed_requests?: number;
    connect_avg?: number;
    receive_avg?: number;
    send_avg?: number;
    waiting_avg?: number;
  };
  thresholds?: Array<{
    name: string;
    expression?: string;
    actual?: number;
    result: 'passed' | 'failed';
  }>;
  errors?: Array<{
    message: string;
    count: number;
    rate?: number;
  }>;
  series?: Array<{
    timestamp: string;
    active_threads?: number;
    requests?: number;
    errors?: number;
    error_delta?: number;
    throughput?: number;
    response_time?: number;
    error_rate?: number;
    p95?: number;
  }>;
}

export interface CollectedResults {
  type: 'test' | 'suite' | 'loadtest';
  suiteRun?: SuiteRunResult;
  testRuns: TestRunResult[];
  load?: LoadReportData;
}

function getEventKey(event: {id?: string; runId?: string}): string | undefined {
  return event.id ?? event.runId;
}

export function createReportCollector() {
  const testRunsByKey = new Map<string, TestRunResult>();
  let suiteRun: SuiteRunResult | undefined;
  let hasSuiteEvents = false;
  let load: LoadReportData | undefined;

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
        suiteTitle: event.suiteTitle,
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
        run.displayName = event.title || event.entry;
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
        title: event.title,
        details: event.details,
        expects: event.expects,
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

    if (scope === 'loadtest-summary') {
      const event = message as LoadTestSummaryEvent;
      load = event.load;
      return;
    }
  }

  function getResults(): CollectedResults {
    const allRuns = Array.from(testRunsByKey.values());

    if (load) {
      if (hasSuiteEvents && suiteRun) {
        suiteRun.testRuns = allRuns;
      }
      return {
        type: 'loadtest',
        suiteRun,
        testRuns: allRuns,
        load,
      };
    }

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
