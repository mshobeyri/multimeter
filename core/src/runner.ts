import {LogLevel} from './CommonData';
import docHtml from './docHtml';
import docMarkdown from './docMarkdown';
import {executeApi, prepareApiRun} from './runApi';
import {basename, detectDocType, PreparedRun, RunFileResult, runGeneratedJs} from './runCommon';
import {mergeEnv, RunFileOptions, RunReporterMessage} from './runConfig';
import {executeSuite, prepareSuiteRun} from './runSuite';
import {executeSuiteBundle} from './suiteBundleRunner';
import {executeTest, generateTestJs, prepareTestRun} from './runTest';

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
  const {file, fileType, filePath: optFilePath} = options as any;
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
    specific = prepareTestRun(rawText, manualInputs);
  } else if (docType === 'suite') {
    specific = prepareSuiteRun(rawText, manualInputs);
  }

  return {
    rawText,
    filePath,
    baseName,
    docType,
    envVarsUsed,
    inputsUsed: manualInputs,
    ...specific,
  };
}

export async function runFile(options: RunFileOptions): Promise<RunFileResult> {
  
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
    return executeTest(prepared, options, preLogs);
  }

  if (docType === 'suite') {
    if ((options as any).suiteBundle) {
      return executeSuiteBundle({
        bundle: (options as any).suiteBundle,
        options,
        preLogs,
        runFile,
      });
    }
    return executeSuite(prepared, options, preLogs, runFile);
  }

  throw new Error('Run is currently supported for test or api documents only.');
}
