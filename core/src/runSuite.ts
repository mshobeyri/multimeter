import {LogLevel} from './CommonData';
import {basename, detectDocType, PreparedRun, resolveRelativeTo, RunFileResult, sanitizeIdentifier} from './runCommon';
import {RunFileOptions, RunResult, SuiteStepStatus} from './runConfig';
import {splitSuiteGroups, yamlToSuite} from './suiteParsePack';

export function prepareSuiteRun(
    rawText: string, manualInputs: Record<string, any>): Partial<PreparedRun> {
  const suite = yamlToSuite(rawText);
  return {
    title: suite.title,
    inputsUsed: manualInputs,
  };
}

export async function executeSuite(
    prepared: PreparedRun, options: RunFileOptions,
    preLogs: {level: LogLevel; message: string}[],
    runFile: (options: RunFileOptions) =>
        Promise<RunFileResult>): Promise<RunFileResult> {
  const {
    docType,
    baseName,
    rawText,
    title,
    envVarsUsed: envVars,
  } = prepared;
  const {fileLoader} = options;

  const suite = yamlToSuite(rawText);
  const mergedInputsUsed = {...(options.manualInputs || {})};

  const groups = splitSuiteGroups(suite.tests);
  const suiteDisplayName = title || baseName;
  const identifier = sanitizeIdentifier(suiteDisplayName);

  const allLogs: string[] = [];
  const allErrors: string[] = [];
  const suiteStart = Date.now();

  const suiteLogger = (level: LogLevel, msg: string) => {
    allLogs.push(String(msg));
    if (level === 'error') {
      allErrors.push(String(msg));
    }
    options.logger(level, msg);
  };

  options.reporter && options.reporter({
    scope: 'suite-run-start',
    runId: `suite:${sanitizeIdentifier(prepared.filePath)}`,
    suitePath: prepared.filePath,
    startedAt: suiteStart,
    totalRunnable: (suite.tests ?? []).filter((t) => String(t ?? '').trim() && String(t ?? '').trim() !== 'then').length,
  } as any);

  suiteLogger('info', `Running suite: ${suiteDisplayName}`);

  let overallSuccess = true;

  for (let gi = 0; gi < groups.length; gi++) {
    if (options.abortSignal?.aborted) {
      suiteLogger('warn', 'Suite run cancelled.');
      overallSuccess = false;
      break;
    }
    const group = groups[gi];
    suiteLogger('info', `Running group: ${gi + 1}/${groups.length}`);

    const results = await Promise.all(group.map(async (entry, entryIndex) => {
      if (options.abortSignal?.aborted) {
        return {
          entry,
          filePath: resolveRelativeTo(entry, prepared.filePath),
          docType: null,
          success: false,
          status: 'failed' as SuiteStepStatus,
          errors: ['Suite run cancelled'],
          logs: [],
          groupIndex: gi,
          groupItemIndex: entryIndex,
          threw: false,
        };
      }
      const childFilePath = resolveRelativeTo(entry, prepared.filePath);
      const display = basename(childFilePath || entry);
      const runId = `suite:${sanitizeIdentifier(prepared.filePath)}:${gi}:${entryIndex}:${sanitizeIdentifier(childFilePath || entry)}`;
      try {
        const childRawText = await fileLoader(childFilePath);
        const childDocType = detectDocType(childFilePath, childRawText);

        const testId = `${gi}:${entryIndex}`;
        options.reporter && options.reporter({
          scope: 'suite-item',
          status: 'running',
          groupIndex: gi,
          groupItemIndex: entryIndex,
          runId,
          filePath: childFilePath,
          entry,
          docType: childDocType ?? undefined,
          testId,
        });

        suiteLogger('info', `Running suite item: ${display}`);
        const childFileLoader = async (requestedPath: string) => {
          const resolved = resolveRelativeTo(requestedPath, childFilePath);
          return await fileLoader(resolved);
        };
        const childRun = await runFile({
          ...options,
          file: childRawText,
          fileType: 'raw',
          filePath: childFilePath,
          manualInputs: mergedInputsUsed,
          fileLoader: childFileLoader,
          logger: suiteLogger,
          testId,
        } as any);

        const status: SuiteStepStatus =
            childRun.result?.success ? 'passed' : 'failed';
        const result = {
          entry,
          filePath: childFilePath,
          docType: childDocType ?? undefined,
          success: !!childRun.result?.success,
          status,
          errors: childRun.result?.errors ?? [],
          logs: childRun.result?.logs ?? [],
          threw: childRun.result?.threw === true,
        };

        options.reporter && options.reporter({
          scope: 'suite-item',
          groupIndex: gi,
          groupItemIndex: entryIndex,
          status,
          runId,
          filePath: childFilePath,
          entry,
          docType: childDocType ?? undefined,
          testId,
        });

        return result;
      } catch (e: any) {
        const errorMessage = e?.message || String(e);
        suiteLogger(
            'error', `Failed to run suite item: ${display} - ${errorMessage}`);

        const status: SuiteStepStatus = 'failed';
        const result = {
          entry,
          filePath: childFilePath,
          docType: null,
          success: false,
          status,
          errors: [errorMessage],
          logs: [],
          groupIndex: gi,
          groupItemIndex: entryIndex,
          threw: true,
        };
        const testId = `${gi}:${entryIndex}`;
        options.reporter && options.reporter({
          scope: 'suite-item',
          groupIndex: gi,
          groupItemIndex: entryIndex,
          status,
          runId,
          filePath: childFilePath,
          entry,
          testId,
        });
        return result;
      }
    }));

    const groupHadAnyFailure = results.some(r => !r || !r.success);
    const groupThrew = results.some(r => !!r && r.threw === true);

    if (groupHadAnyFailure) {
      overallSuccess = false;
    }

    if (groupThrew) {
      // Stop executing further groups when an item threw (assert-like failure).
      break;
    }
  }

  const durationMs = Date.now() - suiteStart;
  const result: RunResult = {
    success: overallSuccess,
    durationMs,
    errors: allErrors,
    logs: allLogs,
  };
  options.reporter && options.reporter({
    scope: 'suite-run-finished',
    runId: `suite:${sanitizeIdentifier(prepared.filePath)}`,
    suitePath: prepared.filePath,
    finishedAt: Date.now(),
    success: overallSuccess,
    durationMs,
    cancelled: options.abortSignal?.aborted === true,
  } as any);
  if (preLogs.length) {
    result.logs = [...preLogs.map(l => l.message), ...(result.logs ?? [])];
  }
  return {
    js: '',
    result,
    identifier,
    displayName: suiteDisplayName,
    docType,
    inputsUsed: mergedInputsUsed,
    envVarsUsed: envVars
  };
}