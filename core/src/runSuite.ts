import {LogLevel} from './CommonData';
import {basename, detectDocType, PreparedRun, resolveRelativeTo, RunFileResult, sanitizeIdentifier} from './runCommon';
import {RunFileOptions, RunResult} from './runConfig';
import {splitSuiteGroups, yamlToSuite} from './suiteParsePack';

export function prepareSuiteRun(
    rawText: string, manualInputs: Record<string, any>): Partial<PreparedRun> {
  const suite = yamlToSuite(rawText);
  return {
    title: suite.title, inputsUsed: manualInputs,
  };
}

export async function executeSuite(
    prepared: PreparedRun, options: RunFileOptions,
    sinkLogger: (level: LogLevel, msg: string) => void,
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
    sinkLogger(level, msg);
  };

  suiteLogger('info', `Running suite: ${suiteDisplayName}`);

  let overallSuccess = true;

  for (let gi = 0; gi < groups.length; gi++) {
    const group = groups[gi];
    suiteLogger('info', `Running group: ${gi + 1}/${groups.length}`);

    const results = await Promise.all(group.map(async (entry, entryIndex) => {
      const childFilePath = resolveRelativeTo(entry, prepared.filePath);
      const display = basename(childFilePath || entry);
      try {
        const childRawText = await fileLoader(childFilePath);
        const childDocType = detectDocType(childFilePath, childRawText);

        options.reporter && options.reporter({
          status: 'running',
          groupIndex: gi,
          groupItemIndex: entryIndex,
        });

        suiteLogger('info', `Running suite item: ${display}`);
        const childRun = await runFile({
          ...options,
          file: childRawText,
          fileType: 'raw',
          filePath: childFilePath,
          manualInputs: mergedInputsUsed,
          logger: suiteLogger
        } as any);

        const result = {
          entry,
          filePath: childFilePath,
          docType: childDocType,
          success: !!childRun.result?.success,
          status: !!childRun.result?.success ? 'passed' : 'failed',
          errors: childRun.result?.errors ?? [],
          logs: childRun.result?.logs ?? [],
          threw: childRun.result?.threw === true,
        };

        options.reporter && options.reporter({
          groupIndex: gi,
          groupItemIndex: entryIndex,
          status: result.status,
        });

        return result;
      } catch (e: any) {
        const errorMessage = e?.message || String(e);
        suiteLogger(
            'error', `Failed to run suite item: ${display} - ${errorMessage}`);

        const result = {
          entry,
          filePath: childFilePath,
          docType: null,
          success: false,
          status: 'failed',
          errors: [errorMessage],
          logs: [],
          groupIndex: gi,
          groupItemIndex: entryIndex,
          threw: true,
        };
        options.reporter && options.reporter({
          groupIndex: gi,
          groupItemIndex: entryIndex,
          status: result.status,
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