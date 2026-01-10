import {LogLevel} from './CommonData';
// Import your send function from the network core
import {send, setRunnerNetworkConfig} from './networkCoreNode';
import {extractOutputs} from './outputExtractor';
import * as Random from './Random';
import * as mmtHelper from './testHelper';

export interface RunJSCodeContext {
  runId: string;
  js: string;
  title: string;
  logger: (level: LogLevel, message: string) => void;
  reporter?: (message: any) => void;
  testId?: string;
  nodeId?: string;
}

const REPORTER_KEY = '__mmtReportStep';
const RUN_ID_KEY = '__mmtRunId';
const TEST_ID_KEY = '__mmtTestId';

const applyReporterGlobals = (
    reporter: ((message: any) => void)|undefined, runId: string,
    testId?: string): (() => void) => {
  const scope = globalThis as Record<string, any>;
  const hadReporter = Object.prototype.hasOwnProperty.call(scope, REPORTER_KEY);
  const hadRunId = Object.prototype.hasOwnProperty.call(scope, RUN_ID_KEY);
  const hadTestId = Object.prototype.hasOwnProperty.call(scope, TEST_ID_KEY);
  const previousReporter = scope[REPORTER_KEY];
  const previousRunId = scope[RUN_ID_KEY];
  const previousTestId = scope[TEST_ID_KEY];
  if (reporter) {
    scope[REPORTER_KEY] = reporter;
  } else {
    delete scope[REPORTER_KEY];
  }
  scope[RUN_ID_KEY] = runId;
  if (typeof testId === 'string' && testId) {
    scope[TEST_ID_KEY] = testId;
  } else {
    delete scope[TEST_ID_KEY];
  }
  return () => {
    if (hadReporter) {
      scope[REPORTER_KEY] = previousReporter;
    } else {
      delete scope[REPORTER_KEY];
    }
    if (hadRunId) {
      scope[RUN_ID_KEY] = previousRunId;
    } else if (Object.prototype.hasOwnProperty.call(scope, RUN_ID_KEY)) {
      delete scope[RUN_ID_KEY];
    }
    if (hadTestId) {
      scope[TEST_ID_KEY] = previousTestId;
    } else if (Object.prototype.hasOwnProperty.call(scope, TEST_ID_KEY)) {
      delete scope[TEST_ID_KEY];
    }
  };
};

export async function runJSCode(context: RunJSCodeContext): Promise<any> {
  const {js: code, title, logger: lg, reporter} = context;
  const oldNodeId = (globalThis as any).__mmtNodeId;
  (globalThis as any).__mmtNodeId = context.nodeId;
  lg('info', `Running test: ${title}...`);
  const startTime = Date.now();
  const runId = typeof context?.runId === 'string' ? context.runId : '';
  const reporterFn = typeof reporter === 'function' ? reporter : undefined;
  const restoreReporterGlobals = applyReporterGlobals(
      reporterFn, runId, context.testId);

  const customConsole = {
    trace: (...args: any[]) => lg(
        'trace',
        args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ')),
    debug: (...args: any[]) => lg(
        'debug',
        args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ')),
    log: (...args: any[]) => lg(
        'info',
        args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ')),
    warn: (...args: any[]) => lg(
        'warn',
        args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ')),
    error: (...args: any[]) => lg(
        'error',
        args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ')),
  };

  try {
    const helperDecls =
        Object.keys(mmtHelper)
            .map(name => `const ${name} = mmtHelper["${name}"];`)
            .join('\n');
    const randomDecls =
        Object.keys(Random)
            .filter(name => typeof (Random as any)[name] === 'function')
            .map(name => `const ${name} = Random["${name}"];`)
            .join('\n');
    const fn = new Function(
        'mmtHelper', 'console', 'send_', 'extractOutputs_', 'Random',
        `${helperDecls}\n${randomDecls}\n${code}`);
    await fn(mmtHelper, customConsole, send, extractOutputs, Random);
  } catch (e: any) {
    lg('error', 'Error running test: ' + (e?.message || String(e)));
  } finally {
    restoreReporterGlobals();
    (globalThis as any).__mmtNodeId = oldNodeId;
    const elapsed = Date.now() - startTime;
    lg('info', `Test ${title ? title + ' ' : ''}finished in ${elapsed} ms`);
  }
  return;
}

export {setRunnerNetworkConfig};