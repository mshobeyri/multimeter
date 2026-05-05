import {LogLevel} from './CommonData';
import {yamlToLoadTest} from './loadtestParsePack';
import {createReportCollector, LoadReportData} from './reportCollector';
import {basename, PreparedRun, resolveRelativeTo, RunFileResult, sanitizeIdentifier, SuiteExportSpec} from './runCommon';
import {RunFileOptions, RunReporterMessage, RunResult} from './runConfig';

const LOADTEST_ITEM_ID = 'loadtest-test-0';

function parseDurationMs(value: unknown): number | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim().toLowerCase();
  if (!trimmed || trimmed === 'inf') {
    return undefined;
  }
  const match = trimmed.match(/^(\d+(?:\.\d+)?)(ms|s|m|h)$/);
  if (!match) {
    return undefined;
  }
  const amount = Number(match[1]);
  const unit = match[2];
  if (!Number.isFinite(amount) || amount < 0) {
    return undefined;
  }
  if (unit === 'ms') {
    return Math.round(amount);
  }
  if (unit === 's') {
    return Math.round(amount * 1000);
  }
  if (unit === 'm') {
    return Math.round(amount * 60_000);
  }
  if (unit === 'h') {
    return Math.round(amount * 3_600_000);
  }
  return undefined;
}

function parsePositiveInteger(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.floor(value);
  }
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
    const n = Number(value.trim());
    return n > 0 ? n : undefined;
  }
  return undefined;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0 || signal?.aborted) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    if (signal) {
      const onAbort = () => {
        clearTimeout(timer);
        resolve();
      };
      signal.addEventListener('abort', onAbort, {once: true});
    }
  });
}

export function prepareLoadTestRun(
  rawText: string,
  manualInputs: Record<string, any>,
): Partial<PreparedRun> {
  const loadtest = yamlToLoadTest(rawText);
  return {
    title: loadtest.title,
    inputsUsed: manualInputs,
    loadtestConfig: {
      title: loadtest.title,
      test: loadtest.test,
      threads: loadtest.threads,
      repeat: loadtest.repeat,
      rampup: loadtest.rampup,
      environment: loadtest.environment,
      export: loadtest.export,
    },
  };
}

export async function executeLoadTest(
  prepared: PreparedRun,
  options: RunFileOptions,
  preLogs: {level: LogLevel; message: string}[],
  runFile: (options: RunFileOptions) => Promise<RunFileResult>,
): Promise<RunFileResult> {
  const loadtest = prepared.loadtestConfig ?? yamlToLoadTest(prepared.rawText);
  const displayName = prepared.title || prepared.baseName;
  const identifier = sanitizeIdentifier(displayName);
  const childFilePath = resolveRelativeTo(loadtest.test, prepared.filePath);
  const childDisplayName = basename(childFilePath || loadtest.test);
  const threads = Math.max(1, Math.floor(loadtest.threads || 1));
  const repeatIterations = parsePositiveInteger(loadtest.repeat);
  const repeatDurationMs = repeatIterations === undefined ? parseDurationMs(loadtest.repeat) : undefined;
  const rampupMs = parseDurationMs(loadtest.rampup) || 0;
  const runStartedAt = Date.now();
  const deadline = repeatDurationMs !== undefined ? runStartedAt + repeatDurationMs : undefined;
  const maxIterations = repeatIterations ?? (repeatDurationMs !== undefined ? undefined : 1);
  const allLogs: string[] = [];
  const allErrors: string[] = [];
  const reportCollector = createReportCollector();
  let completed = 0;
  let failed = 0;
  let requestsSent = 0;
  let requestFailures = 0;
  let claimedIterations = 0;
  let sampleCaptured = false;
  let childRawText = '';
  let lastSummaryEmitAt = 0;

  const loadLogger = (level: LogLevel, msg: string) => {
    allLogs.push(String(msg));
    if (level === 'error') {
      allErrors.push(String(msg));
    }
    options.logger(level, msg);
  };

  const recordNetworkTrace = (msg: unknown) => {
    if (typeof msg !== 'string') {
      return;
    }
    if (msg.startsWith('Request:')) {
      requestsSent += 1;
      return;
    }
    if (msg.startsWith('Response: error')) {
      requestFailures += 1;
      return;
    }
    const responseMatch = msg.match(/^Response:\s+(\d+)/);
    if (responseMatch) {
      const status = Number(responseMatch[1]);
      if (Number.isFinite(status) && status >= 400) {
        requestFailures += 1;
      }
    }
  };

  const rootRunId = `loadtest:${sanitizeIdentifier(prepared.filePath)}:${runStartedAt}`;

  const emit = (message: RunReporterMessage) => {
    reportCollector.reporter(message);
    options.reporter && options.reporter(message);
  };

  const buildLoadResult = (finishedAt: number): LoadReportData => {
    const durationMs = Math.max(0, finishedAt - runStartedAt);
    const requests = requestsSent > 0 ? requestsSent : completed;
    const failures = requestsSent > 0 ? requestFailures : failed;
    const successes = Math.max(0, requests - failures);
    return {
      tool: 'multimeter',
      scenario: loadtest.title || displayName,
      test: loadtest.test,
      config: {
        threads,
        repeat: loadtest.repeat,
        rampup: loadtest.rampup,
        started_at: new Date(runStartedAt).toISOString(),
        finished_at: new Date(finishedAt).toISOString(),
      },
      summary: {
        iterations: completed,
        requests,
        successes,
        failures,
        success_rate: requests > 0 ? successes / requests : 0,
        failed_rate: requests > 0 ? failures / requests : 0,
        error_rate: requests > 0 ? failures / requests : 0,
        throughput: durationMs > 0 ? requests / (durationMs / 1000) : requests,
      },
    };
  };

  const emitLoadSummary = (force = false) => {
    const now = Date.now();
    if (!force && now - lastSummaryEmitAt < 1000) {
      return;
    }
    lastSummaryEmitAt = now;
    emit({
      scope: 'loadtest-summary',
      runId: rootRunId,
      id: LOADTEST_ITEM_ID,
      load: buildLoadResult(now),
    });
  };

  emit({
    scope: 'suite-run-start',
    runId: rootRunId,
    suitePath: prepared.filePath,
    suiteTitle: loadtest.title || displayName,
    startedAt: runStartedAt,
    totalRunnable: 1,
  });

  emit({
    scope: 'suite-item',
    status: 'running',
    runId: `${rootRunId}:item`,
    filePath: childFilePath,
    entry: loadtest.test,
    title: childDisplayName,
    docType: 'test',
    id: LOADTEST_ITEM_ID,
  });

  try {
    childRawText = await options.fileLoader(childFilePath);
  } catch (e: any) {
    throw new Error(`Failed to load loadtest target ${loadtest.test}: ${e?.message || String(e)}`);
  }

  const nextIteration = (): number | undefined => {
    if (options.abortSignal?.aborted) {
      return undefined;
    }
    if (deadline !== undefined && Date.now() >= deadline) {
      return undefined;
    }
    if (maxIterations !== undefined && claimedIterations >= maxIterations) {
      return undefined;
    }
    claimedIterations += 1;
    return claimedIterations;
  };

  const runIteration = async (workerIndex: number, iteration: number) => {
    const runId = `${rootRunId}:${iteration}`;
    const isSample = !sampleCaptured;
    if (isSample) {
      sampleCaptured = true;
    }

    const childFileLoader = async (requestedPath: string) => {
      const resolved = resolveRelativeTo(requestedPath, childFilePath);
      return await options.fileLoader(resolved);
    };

    const childReporter = (message: RunReporterMessage) => {
      if (!isSample) {
        return;
      }
      emit({...(message as any), id: LOADTEST_ITEM_ID});
    };

    try {
      const childRun = await runFile({
        ...options,
        file: childRawText,
        fileType: 'raw',
        filePath: childFilePath,
        fileLoader: childFileLoader,
        logger: (level, msg) => {
          recordNetworkTrace(msg);
          if (isSample || level === 'error') {
            loadLogger(level, msg);
          }
        },
        reporter: childReporter,
        runId,
        id: LOADTEST_ITEM_ID,
        __mmtIsSuiteBundleChildRun: true,
      });
      completed += 1;
      if (!childRun.result?.success) {
        failed += 1;
      }
      emitLoadSummary();
    } catch (e: any) {
      completed += 1;
      failed += 1;
      loadLogger('error', `Loadtest worker ${workerIndex + 1}, iteration ${iteration} failed: ${e?.message || String(e)}`);
      emitLoadSummary();
    }
  };

  const worker = async (workerIndex: number) => {
    if (rampupMs > 0 && threads > 1) {
      await sleep(Math.round((rampupMs * workerIndex) / Math.max(1, threads - 1)), options.abortSignal);
    }
    while (!options.abortSignal?.aborted) {
      const iteration = nextIteration();
      if (iteration === undefined) {
        return;
      }
      await runIteration(workerIndex, iteration);
    }
  };

  loadLogger('info', `Running load test: threads=${threads}, repeat=${String(loadtest.repeat ?? 1)}, rampup=${loadtest.rampup ?? '0s'}`);
  await Promise.all(Array.from({length: threads}, (_, index) => worker(index)));

  const finishedAt = Date.now();
  const durationMs = finishedAt - runStartedAt;
  const success = failed === 0 && !options.abortSignal?.aborted;
  const load = buildLoadResult(finishedAt);

  emitLoadSummary(true);

  emit({
    scope: 'suite-item',
    status: success ? 'passed' : 'failed',
    runId: `${rootRunId}:item`,
    filePath: childFilePath,
    entry: loadtest.test,
    title: childDisplayName,
    docType: 'test',
    id: LOADTEST_ITEM_ID,
  });

  emit({
    scope: 'suite-run-finished',
    runId: rootRunId,
    suitePath: prepared.filePath,
    finishedAt,
    success,
    durationMs,
    cancelled: options.abortSignal?.aborted === true,
  });

  const result: RunResult = {
    success,
    durationMs,
    errors: allErrors,
    logs: [...preLogs.map(l => l.message), ...allLogs],
    cancelled: options.abortSignal?.aborted === true,
  };

  let suiteExports: SuiteExportSpec | undefined;
  if (Array.isArray(loadtest.export) && loadtest.export.length > 0) {
    const collectedResults = reportCollector.getResults();
    collectedResults.type = 'loadtest';
    collectedResults.load = load;
    suiteExports = {
      paths: loadtest.export,
      collectedResults,
    };
  }

  return {
    js: '',
    result,
    identifier,
    displayName,
    docType: 'loadtest',
    inputsUsed: options.manualInputs || {},
    envVarsUsed: options.envvar || {},
    suiteExports,
    loadResult: load,
  };
}