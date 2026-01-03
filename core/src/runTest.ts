import {LogLevel} from './CommonData';
import * as JSer from './JSer';
import {isPlainObject, PreparedRun, RunFileResult, runGeneratedJs, sanitizeIdentifier} from './runCommon';
import {GenerateJsOptions, mergeInputs, RunFileOptions, TestRunSummaryEvent, TestStepReporterEvent} from './runConfig';
import * as testParsePack from './testParsePack';

const createRunId = (): string => {
  return `${Date.now().toString(36)}-${
      Math.random().toString(36).slice(2, 10)}`;
};

export function prepareTestRun(
    rawText: string, manualInputs: Record<string, any>): Partial<PreparedRun> {
  const testDoc =
      testParsePack.yamlToTest ? testParsePack.yamlToTest(rawText) : {} as any;
  const defaultInputs = isPlainObject(testDoc?.inputs) ?
      testDoc.inputs as Record<string, any>:
      {};
  const inputsUsed = mergeInputs({
    defaultInputs,
    manualInputs,
  });
  return {
    title: testDoc.title,
    inputsUsed,
  };
}

export async function generateTestJs(opts: GenerateJsOptions): Promise<string> {
  const {rawText, name, inputs, envVars, fileLoader} = opts;
  JSer.setFileLoader(async (p: string) => {
    try {
      const t = await fileLoader(p);
      return typeof t === 'string' ? t : '';
    } catch {
      return '';
    }
  });
  const test =
      testParsePack.yamlToTest ? testParsePack.yamlToTest(rawText) : {} as any;
  let js = await JSer.rootTestToJsfunc({test, name, inputs, envVars});
  const anyJSer: any = JSer as any;
  if (anyJSer.variableReplacer &&
      typeof anyJSer.variableReplacer === 'function') {
    js = anyJSer.variableReplacer(js);
  }
  return js;
}

export async function executeTest(
    prepared: PreparedRun, options: RunFileOptions,
    sinkLogger: (level: LogLevel, msg: string) => void,
    preLogs: {level: LogLevel; message: string}[]): Promise<RunFileResult> {
  const {
    docType,
    baseName,
    rawText,
    title,
    envVarsUsed: envVars,
    inputsUsed,
  } = prepared;
  const {fileLoader, jsRunner} = options;

  const displayName = title || baseName;
  const identifier = sanitizeIdentifier(displayName);
  const runId = createRunId();
  const forwardReporter = options.reporter;
  const stepReporter = forwardReporter ? (event: TestStepReporterEvent) => {
    const payload: TestStepReporterEvent = {
      ...event,
      runId: event.runId || runId,
    };
    forwardReporter(payload);
  } : undefined;
  const js = await generateTestJs({
    rawText,
    name: identifier,
    inputs: inputsUsed,
    envVars,
    fileLoader,
  });
  const result = await runGeneratedJs(
      runId, js, displayName, sinkLogger, jsRunner, stepReporter);
  if (forwardReporter) {
    const summary: TestRunSummaryEvent = {
      scope: 'test-step-run',
      runId,
      result: result.success ? 'passed' : 'failed',
    };
    forwardReporter(summary);
  }
  if (preLogs.length) {
    result.logs = [...preLogs.map(l => l.message), ...(result.logs ?? [])];
  }
  return {
    js,
    result,
    identifier,
    displayName,
    docType,
    inputsUsed,
    envVarsUsed: envVars,
    exampleName: prepared.exampleName,
    exampleIndex: prepared.exampleIndex,
  };
}