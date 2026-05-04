import {LogLevel} from './CommonData';
import {yamlToLoadTest} from './loadtestParsePack';
import {PreparedRun, RunFileResult, sanitizeIdentifier} from './runCommon';
import {RunFileOptions} from './runConfig';
import {executeSuiteBundle} from './suiteBundleRunner';

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

  const result = await executeSuiteBundle({
    bundle: {
      rootSuitePath: prepared.filePath,
      rootTitle: loadtest.title,
      bundle: [
        {
          kind: 'group',
          id: 'loadtest-group-0',
          label: 'Group 1',
          children: [
            {
              kind: 'test',
              id: 'loadtest-test-0',
              path: loadtest.test,
              title: loadtest.title,
            },
          ],
        },
      ],
      environment: loadtest.environment,
      export: loadtest.export,
    },
    options,
    preLogs,
    runFile,
  });

  return {
    ...result,
    identifier,
    displayName,
    docType: 'loadtest',
  };
}