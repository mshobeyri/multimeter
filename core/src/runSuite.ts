import {LogLevel} from './CommonData';
import {basename, detectDocType, PreparedRun, resolveRelativeTo, RunFileResult, sanitizeIdentifier} from './runCommon';
import {RunFileOptions, RunResult, SuiteStepStatus} from './runConfig';
import {splitSuiteGroups, yamlToSuite} from './suiteParsePack';
import {isProjectRootImport, resolveProjectRootImport} from './fileHelper';
import {stopAllServers_, registerServer_} from './testHelper';

const stableIdForSuiteItem = (params: {
  suitePath: string;
  groupIndex: number;
  groupItemIndex: number;
  entry: string;
  filePath: string;
}): string => {
  const {suitePath, groupIndex, groupItemIndex, entry, filePath} = params;
  // Needs to be stable within a given suite file so UI can target reliably.
  return `${sanitizeIdentifier(suitePath)}:${groupIndex}:${groupItemIndex}:${sanitizeIdentifier(filePath || entry)}`;
};

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

  // Merge suite-level environment variables into the envvar dict for child runs.
  // This ensures `environment.variables` defined in the suite file are available
  // to child test/api files without requiring the caller (CLI/extension) to do it.
  const suiteEnvVars = suite.environment?.variables || {};
  const childEnvvar = Object.keys(suiteEnvVars).length > 0
    ? {...(options.envvar || {}), ...suiteEnvVars, ...(options.manualEnvvars || {})}
    : options.envvar;

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

  const shouldRunItem = (_id: string): boolean => {
    return true;
  };

  suiteLogger('debug', `Running suite: ${suiteDisplayName}`);

  let overallSuccess = true;
  const serverCleanups: Array<() => void> = [];

  try {
  // Start suite-level servers (from the `servers:` field) before running tests.
  if (Array.isArray(suite.servers) && suite.servers.length > 0) {
    for (const serverPath of suite.servers) {
      if (options.abortSignal?.aborted) {
        suiteLogger('warn', 'Suite run cancelled before servers could start.');
        overallSuccess = false;
        break;
      }
      const resolvedPath = resolveRelativeTo(serverPath, prepared.filePath);
      const display = basename(resolvedPath || serverPath);
      if (!options.serverRunner) {
        suiteLogger('error', `Cannot start server '${display}': no server runner provided`);
        overallSuccess = false;
        break;
      }
      try {
        suiteLogger('info', `Starting suite server: ${display}`);
        const cleanup = await options.serverRunner(serverPath, resolvedPath);
        serverCleanups.push(cleanup);
        // Register the server so tests with `run: mock` won't try to start a duplicate.
        registerServer_(serverPath, cleanup);
        if (resolvedPath && resolvedPath !== serverPath) {
          registerServer_(resolvedPath, cleanup);
        }
        suiteLogger('info', `Suite server started: ${display}`);
      } catch (e: any) {
        const errorMessage = e?.message || String(e);
        suiteLogger('error', `Failed to start suite server '${display}': ${errorMessage}`);
        overallSuccess = false;
        break;
      }
    }
  }

  if (!overallSuccess) {
    // Server startup failed; skip test execution.
  } else {

  for (let gi = 0; gi < groups.length; gi++) {
    if (options.abortSignal?.aborted) {
      suiteLogger('warn', 'Suite run cancelled.');
      overallSuccess = false;
      break;
    }
    const group = groups[gi];
    suiteLogger('debug', `Running group: ${gi + 1}/${groups.length}`);

    const isParallel = group.length > 1;
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
      const childFilePath = isProjectRootImport(entry) && options.projectRoot
        ? resolveProjectRootImport(entry, options.projectRoot)
        : resolveRelativeTo(entry, prepared.filePath);
      const display = basename(childFilePath || entry);
      const runId = `suite:${sanitizeIdentifier(prepared.filePath)}:${gi}:${entryIndex}:${sanitizeIdentifier(childFilePath || entry)}`;
      // Buffer logs per item when running in parallel so output is grouped.
      const logBuffer: Array<{level: LogLevel; msg: string}> = [];
      const childLogger: (level: LogLevel, msg: string) => void = isParallel
        ? (level, msg) => { logBuffer.push({level, msg}); }
        : suiteLogger;
      const flushLogBuffer = () => {
        for (const bufEntry of logBuffer) {
          suiteLogger(bufEntry.level, bufEntry.msg);
        }
        logBuffer.length = 0;
      };

      try {
        const childRawText = await fileLoader(childFilePath);
        const childDocType = detectDocType(childFilePath, childRawText);

        const id = stableIdForSuiteItem({
          suitePath: prepared.filePath,
          groupIndex: gi,
          groupItemIndex: entryIndex,
          entry,
          filePath: childFilePath,
        });

        if (!shouldRunItem(id)) {
          return {
            entry,
            filePath: childFilePath,
            docType: childDocType ?? undefined,
            success: true,
            status: 'passed' as SuiteStepStatus,
            errors: [],
            logs: [],
            threw: false,
            skipped: true,
          } as any;
        }

        options.reporter && options.reporter({
          scope: 'suite-item',
          status: 'running',
          groupIndex: gi,
          groupItemIndex: entryIndex,
          runId,
          filePath: childFilePath,
          entry,
          docType: childDocType ?? undefined,
          id,
        });

        childLogger('debug', `Running suite item: ${display}`);

        const childFileLoader = async (requestedPath: string) => {
          const resolved = isProjectRootImport(requestedPath) && options.projectRoot
            ? resolveProjectRootImport(requestedPath, options.projectRoot)
            : resolveRelativeTo(requestedPath, childFilePath);
          return await fileLoader(resolved);
        };

        const childRun = await runFile({
          ...options,
          envvar: childEnvvar,
          file: childRawText,
          fileType: 'raw',
          filePath: childFilePath,
          manualInputs: mergedInputsUsed,
          fileLoader: childFileLoader,
          logger: childLogger,
          id,
          runId,
          skipServerCleanup: true,
        } as any);

        flushLogBuffer();

        const status: SuiteStepStatus =
            childRun.result?.success ? 'passed' :
            childRun.result?.syntaxError ? 'invalid' :
            'failed';
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
          id,
        });

        return result;
      } catch (e: any) {
        flushLogBuffer();
        const errorMessage = e?.message || String(e);
        suiteLogger('error', `Failed to run suite item: ${display} - ${errorMessage}`);

        const isInvalid = [
          'Invalid test file', 'Invalid API file', 'Import error',
          'unknown key(s)', 'is not imported', 'undefined input(s)', 'YAML',
        ].some(p => errorMessage.includes(p));
        const status: SuiteStepStatus = isInvalid ? 'invalid' : 'failed';
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

        const id = stableIdForSuiteItem({
          suitePath: prepared.filePath,
          groupIndex: gi,
          groupItemIndex: entryIndex,
          entry,
          filePath: childFilePath,
        });

        options.reporter && options.reporter({
          scope: 'suite-item',
          groupIndex: gi,
          groupItemIndex: entryIndex,
          status,
          runId,
          filePath: childFilePath,
          entry,
          id,
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

  } // end else (server startup succeeded)

  } finally {
    // Stop all suite-level servers (from `servers:` field).
    for (const cleanup of serverCleanups) {
      try {
        cleanup();
      } catch (e: any) {
        suiteLogger('warn', `Error stopping server: ${e?.message || String(e)}`);
      }
    }
    // Stop any servers started via `run: mock` steps in child tests.
    try {
      stopAllServers_();
    } catch (e: any) {
      suiteLogger('warn', `Error stopping servers: ${e?.message || String(e)}`);
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