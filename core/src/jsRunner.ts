import {LogLevel} from './CommonData';
import {normalizeTokenName} from './JSerHelper';
// Import your send function from the network core
import {send, setRunnerNetworkConfig} from './networkCoreNode';
import {extractOutputs} from './outputExtractor';
import * as Random from './Random';
import * as Current from './Current';
import * as mmtHelper from './testHelper';
import type {ServerRunner} from './testHelper';

export interface RunJSCodeContext {
  runId: string;
  js: string;
  title: string;
  logger: (level: LogLevel, message: string) => void;
  fileLoader?: (path: string) => Promise<string>;
  reporter?: (message: any) => void;
  id?: string;
  abortSignal?: AbortSignal;
  /** When true, wrap send_ with trace-level request/response logging (used by test runs). */
  traceSend?: boolean;
  /** Optional server runner for starting mock servers in tests. */
  serverRunner?: ServerRunner;
  /** When true, do not stop servers after execution. Suite runners set this. */
  skipServerCleanup?: boolean;
}

const REPORTER_KEY = '__mmtReportStep';
const RUN_ID_KEY = '__mmtRunId';
const ID_KEY = '__mmtId';

// Runtime helper to get random value by token name
function mmtRandom(name: string): any {
  const normalized = normalizeTokenName(name);
  const fn = Random.RANDOM_TOKEN_MAP[normalized] || Random.RANDOM_TOKEN_MAP[name];
  if (!fn) {
    return `r:${name}`;  // Return original token if not found
  }
  return fn();
}

// Runtime helper to get current value by token name
function mmtCurrent(name: string): any {
  const normalized = normalizeTokenName(name);
  const fn = Current.CURRENT_TOKEN_MAP[normalized] || Current.CURRENT_TOKEN_MAP[name];
  if (!fn) {
    return `c:${name}`;  // Return original token if not found
  }
  return fn();
}

const applyReporterGlobals = (
    reporter: ((message: any) => void)|undefined, runId: string,
    id?: string): (() => void) => {
  const scope = globalThis as Record<string, any>;
  const hadReporter = Object.prototype.hasOwnProperty.call(scope, REPORTER_KEY);
  const hadRunId = Object.prototype.hasOwnProperty.call(scope, RUN_ID_KEY);
  const hadId = Object.prototype.hasOwnProperty.call(scope, ID_KEY);
  const previousReporter = scope[REPORTER_KEY];
  const previousRunId = scope[RUN_ID_KEY];
  const previousId = scope[ID_KEY];
  if (reporter) {
    scope[REPORTER_KEY] = reporter;
  } else {
    delete scope[REPORTER_KEY];
  }
  scope[RUN_ID_KEY] = runId;
  if (typeof id === 'string' && id) {
    scope[ID_KEY] = id;
  } else {
    delete scope[ID_KEY];
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
    if (hadId) {
      scope[ID_KEY] = previousId;
    } else if (Object.prototype.hasOwnProperty.call(scope, ID_KEY)) {
      delete scope[ID_KEY];
    }
  };
};

export async function runJSCode(context: RunJSCodeContext): Promise<any> {
  const {js: code, title, logger: lg, reporter} = context;
  lg('info', `Running test: ${title}...`);
  const startTime = Date.now();
  const runId = typeof context?.runId === 'string' ? context.runId : '';
  const reporterFn = typeof reporter === 'function' ? reporter : undefined;
  const restoreReporterGlobals = applyReporterGlobals(
  reporterFn, runId, context.id);

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

  // Set the file loader BEFORE we build the Function; otherwise hoisted
  // importJsModule_() calls at module scope will run before loader is ready.
  if ('setFileLoader_' in mmtHelper && typeof (mmtHelper as any).setFileLoader_ === 'function') {
    (mmtHelper as any).setFileLoader_(typeof context.fileLoader === 'function' ? context.fileLoader : undefined);
  }

  // Set the abort signal so checkAbort_() can cooperatively cancel between steps.
  if ('setAbortSignal_' in mmtHelper && typeof (mmtHelper as any).setAbortSignal_ === 'function') {
    (mmtHelper as any).setAbortSignal_(context.abortSignal);
  }

  // Set the server runner for starting mock servers in tests.
  if ('setServerRunner_' in mmtHelper && typeof (mmtHelper as any).setServerRunner_ === 'function') {
    (mmtHelper as any).setServerRunner_(context.serverRunner);
  }

  try {
    const helperDecls =
          Object.keys(mmtHelper)
              .filter(name => name !== 'report_' && name !== 'setenv_')
              .map(name => `const ${name} = mmtHelper["${name}"];`)
              .join('\n');
    const randomDecls =
        Object.keys(Random)
            .filter(name => typeof (Random as any)[name] === 'function')
            .map(name => `const ${name} = Random["${name}"];`)
            .join('\n');
    const fn = new Function(
      'mmtHelper', 'console', 'send_', 'extractOutputs_', 'Random',
      '__reporter', '__runId', '__id', '__mmt_random', '__mmt_current',
      `${helperDecls}\n${randomDecls}\n` +
      `const report_ = (...args) => mmtHelper.reportWithContext_(__reporter, __runId, __id, ...args);\n` +
      `const setenv_ = (name, value) => mmtHelper.setenvWithContext_(__reporter, __runId, __id, name, value);\n` +
      `${code}`);
    // Wrap send_ with trace-level request/response logging for test runs
    const sendFn = context.traceSend ? async (req: any) => {
      const reqSummary = req ? `${(req.method || 'GET').toUpperCase()} ${req.url || ''}` : 'unknown';
      lg('trace', `Request: ${reqSummary}`);
      try {
        const res = await send(req);
        const status = res && typeof res.status === 'number' ? res.status : '?';
        const duration = res && typeof res.duration === 'number' ? ` (${res.duration}ms)` : '';
        lg('trace', `Response: ${status}${duration}`);
        return res;
      } catch (err: any) {
        lg('trace', `Response: error - ${err?.message || String(err)}`);
        throw err;
      }
    } : send;
    const returnValue = await fn(mmtHelper, customConsole, sendFn, extractOutputs, Random, reporterFn, runId, context.id, mmtRandom, mmtCurrent);
    restoreReporterGlobals();
    const elapsed = Date.now() - startTime;
    lg('info', `Test ${title ? title + ' ' : ''}finished in ${elapsed} ms`);
    return returnValue;
  } catch (e: any) {
    // Suppress noisy error logging for intentional abort.
    const isAbort = e?.name === 'TestAbortError';
    if (!isAbort) {
      lg('error', 'Error running test: ' + (e?.message || String(e)));
    }
    restoreReporterGlobals();
    const elapsed = Date.now() - startTime;
    lg('info', `Test ${title ? title + ' ' : ''}finished in ${elapsed} ms`);
    if (isAbort) {
      throw e;
    }
    return undefined;
  } finally {
    // Clear abort signal after run completes.
    if ('setAbortSignal_' in mmtHelper && typeof (mmtHelper as any).setAbortSignal_ === 'function') {
      (mmtHelper as any).setAbortSignal_(undefined);
    }
    // Stop all servers started during this test run, unless suite runner is handling cleanup.
    if (!context.skipServerCleanup) {
      if ('stopAllServers_' in mmtHelper && typeof (mmtHelper as any).stopAllServers_ === 'function') {
        (mmtHelper as any).stopAllServers_();
      }
      // Clear server runner.
      if ('setServerRunner_' in mmtHelper && typeof (mmtHelper as any).setServerRunner_ === 'function') {
        (mmtHelper as any).setServerRunner_(undefined);
      }
    }
  }
}

export {setRunnerNetworkConfig};