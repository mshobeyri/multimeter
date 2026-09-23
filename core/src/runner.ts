import {LogLevel} from './CommonData';
import docHtml from './docHtml';
import docMarkdown from './docMarkdown';
import {executeApi, prepareApiRun} from './runApi';
import {basename, detectDocType, PreparedRun, RunFileResult, runGeneratedJs} from './runCommon';
import {mergeEnv, resolveDocumentEnvVars, RunFileOptions, RunReporterMessage} from './runConfig';
import {prepareSuiteRun} from './runSuite';
import {executeSuiteBundle} from './suiteBundleRunner';
import {buildSuiteHierarchyFromSuiteFile} from './suiteHierarchy';
import {createSuiteBundle} from './suiteBundle';
import {executeLoadTest, prepareLoadTestRun} from './runLoadTest';
import {executeTest, generateTestJs, isSerializedMmtTest, prepareTestRun} from './runTest';
import {decideTagRun} from './suiteTagFilter';
import {yamlToTest} from './testParsePack';
import {processDataImportsInYaml} from './dataImportProcessor';
import {isBrunoFilePath} from './brunoParsePack';
import {isHttpFilePath} from './httpParsePack';
import {
  resetCurrentTokenCache,
  resetRandomTokenCache,
} from './variableReplacer';
import {getRunFileCache} from './runFileCache';

export {generateTestJs, runGeneratedJs};

export type{PreparedRun, RunFileResult};

export interface BuildDocOptions {
  title?: string;
  description?: string;
  logo?: string;
  sources?: string[];
  services?: any[];
  format?: 'html'|'md';
}

export function buildDocFromApis(apis: any[], opts: BuildDocOptions): string {
  const {format = 'html', ...rest} = opts || {};
  if (format === 'md') {
    return (docMarkdown as any).buildDocMarkdown(apis, rest);
  }
  return docHtml.buildDocHtml(apis, rest);
}

export async function prepareRunFromOptions(
    options: RunFileOptions,
    log: (level: LogLevel, message: string) => void =
        () => {}): Promise<PreparedRun> {
  const {file, fileType, filePath: optFilePath} = options;
  const filePath = typeof optFilePath === 'string' && optFilePath ?
      optFilePath :
      (fileType === 'path' ? file : '');
  let rawText = file;
  if (fileType === 'path') {
    try {
      rawText = await options.fileLoader(filePath || file);
    } catch {
      rawText = '';
    }
  }
  const docType = detectDocType(filePath, rawText);
  const nativeExternalTest = (isBrunoFilePath(filePath) || isHttpFilePath(filePath)) &&
      !isSerializedMmtTest(rawText);
  if (docType && !nativeExternalTest) {
    rawText = await processDataImportsInYaml({
      rawText,
      filePath,
      projectRoot: options.projectRoot,
      fileLoader: options.fileLoader,
      keepDataImports: docType === 'test',
    });
  }
  const envVarsUsed = mergeEnv({
    envvar: options.envvar,
    manualEnvvars: options.manualEnvvars,
  });
  const baseName = basename(filePath || '');
  const manualInputs: Record<string, any> = {...(options.manualInputs || {})};

  let specific: Partial<PreparedRun> = {};
  if (docType === 'api') {
    specific = prepareApiRun(
        rawText, manualInputs,
        {exampleIndex: options.exampleIndex, exampleName: options.exampleName},
        log);
  } else if (docType === 'test') {
    specific = prepareTestRun(rawText, manualInputs, filePath);
  } else if (docType === 'suite') {
    specific = prepareSuiteRun(rawText, manualInputs);
  } else if (docType === 'loadtest') {
    specific = prepareLoadTestRun(rawText, manualInputs);
  }

  let resolvedEnvVarsUsed = envVarsUsed;
  if (docType === 'loadtest') {
    resolvedEnvVarsUsed = await resolveDocumentEnvVars({
      documentEnv: (specific as any)?.loadtestConfig?.environment,
      filePath,
      projectRoot: options.projectRoot,
      baseEnvVars: options.envvar || {},
      manualEnvvars: options.manualEnvvars || {},
      fileLoader: options.fileLoader,
      logger: log,
      cliOverridesSuiteEnv: true,
    });
  }

  return {
    rawText,
    filePath,
    baseName,
    docType,
    envVarsUsed: resolvedEnvVarsUsed,
    inputsUsed: manualInputs,
    ...specific,
  };
}

export async function runFile(options: RunFileOptions): Promise<RunFileResult> {
  // Dynamic token caches keep one value stable while a document is prepared,
  // but must never leak values into a later run (for example across midnight).
  resetCurrentTokenCache();
  resetRandomTokenCache();

  if (!options.__mmtIsSuiteBundleChildRun) {
    const cache = getRunFileCache();
    await cache.beginRun(options.fileStamp);
    if (typeof options.fileLoader === 'function') {
      options = {...options, fileLoader: cache.wrap(options.fileLoader)};
    }
  }

  const preLogs: Array<{level: LogLevel; message: string}> = [];
  const note = (level: LogLevel, message: string) => {
    preLogs.push({level, message});
  };
  
  const prepared = await prepareRunFromOptions(options, note);
  const {docType} = prepared;

  if (docType === 'api') {
    return executeApi(prepared, options, preLogs);
  }

  if (docType === 'test') {
    if (options.tagFilter) {
      try {
        const testDoc = yamlToTest(prepared.rawText);
        if (decideTagRun('test', testDoc.tags, options.tagFilter, options.tagParentSelected === true) === 'skip') {
          options.reporter && options.reporter({
            scope: 'suite-item',
            status: 'skipped',
            runId: options.runId,
            filePath: prepared.filePath,
            title: testDoc.title,
            docType: 'test',
            id: options.id,
          });
          return {
            js: '',
            result: {success: true, durationMs: 0, errors: [], itemStatus: 'skipped'},
            identifier: prepared.baseName,
            displayName: testDoc.title || prepared.baseName,
            docType: 'test',
            inputsUsed: prepared.inputsUsed,
            envVarsUsed: prepared.envVarsUsed,
          } as any;
        }
      } catch {
        // Invalid test still goes through executeTest.
      }
    }
    return executeTest(prepared, options, preLogs);
  }

  if (docType === 'suite') {
    let bundle = options.suiteBundle;
    if (!bundle) {
      const tree = await buildSuiteHierarchyFromSuiteFile({
        suiteFilePath: prepared.filePath,
        suiteRawText: prepared.rawText,
        fileLoader: options.fileLoader,
        projectRoot: options.projectRoot,
      });
      bundle = createSuiteBundle({
        rootSuitePath: prepared.filePath,
        hierarchy: tree,
        servers: tree.servers,
        environment: tree.environment,
        export: tree.export,
      });
    }
    return executeSuiteBundle({
      bundle,
      options: {...options, suiteBundle: bundle},
      preLogs,
      runFile,
    });
  }

  if (docType === 'loadtest') {
    return executeLoadTest(prepared, options, preLogs, runFile);
  }

  throw new Error('Run is currently supported for test or api documents only.');
}
