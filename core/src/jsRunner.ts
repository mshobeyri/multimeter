import {LogLevel} from './CommonData';
import {GrpcRequest, GrpcResponse} from './NetworkData';
import {normalizeTokenName} from './JSerHelper';
import {applyValueAccessor} from './variableReplacer';
// Import your send function from the network core
import {send, setRunnerNetworkConfig, getRunnerNetworkConfig} from './networkCoreNode';
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
  /** Base directory for resolving relative paths (e.g. gRPC proto files). */
  basePath?: string;
  /** True when this JS execution can safely be delegated to an external worker. */
  workerEligible?: boolean;
}

const REPORTER_KEY = '__mmtReportStep';
const RUN_ID_KEY = '__mmtRunId';
const ID_KEY = '__mmtId';
const compiledFunctionCache = new Map<string, Function>();
const MAX_COMPILED_FUNCTION_CACHE_SIZE = 64;

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

function mmtAccess(value: any, accessor: string): any {
  return applyValueAccessor(value, accessor);
}

const applyReporterGlobals = (
    reporter: ((message: any) => void)|undefined, runId: string,
    id?: string): (() => void) => {
  const scope = globalThis as Record<string, any>;
  // Set globals for fallback paths that read them when no explicit
  // closure values are available.  Under parallel execution multiple
  // tests overwrite these concurrently, so callers should prefer the
  // closure-captured values (passed via Function parameters).
  // We no longer attempt save/restore because the interleaved ordering
  // of parallel tests makes the restore unreliable and can leave stale
  // values behind.
  if (reporter) {
    scope[REPORTER_KEY] = reporter;
  }
  scope[RUN_ID_KEY] = runId;
  if (typeof id === 'string' && id) {
    scope[ID_KEY] = id;
  }
  return () => {
    // Intentional no-op: under parallel execution, restoring previous
    // globals is unreliable and causes incorrect routing.  The globals
    // are overwritten by the next test that starts.
  };
};

export async function runJSCode(context: RunJSCodeContext): Promise<any> {
  const {js: code, title, logger: lg, reporter} = context;
  lg('debug', `Running test: ${title}...`);
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
              .filter(name => name !== 'report_' && name !== 'setenv_' &&
                             name !== 'checkAbort_' && name !== 'importJsModule_' &&
                             name !== 'check_' && name !== 'checkExpects_')
              .map(name => `const ${name} = mmtHelper["${name}"];`)
              .join('\n');
    const randomDecls =
        Object.keys(Random)
            .filter(name => typeof (Random as any)[name] === 'function')
            .map(name => `const ${name} = Random["${name}"];`)
            .join('\n');
    const functionBody = `${helperDecls}\n${randomDecls}\n` +
      `const report_ = (...args) => mmtHelper.reportWithContext_(__reporter, __runId, __id, ...args);\n` +
      // setenv_ must update the in-scope envVariables object so that
      // subsequent e: references read the new value within the same run.
      `const setenv_ = (name, value) => { try { envVariables[name] = value; } catch (_e) {} mmtHelper.setenvWithContext_(__reporter, __runId, __id, name, value); };\n` +
      // Override check_ to pass the closure-based report_ so that under
      // parallel execution each test uses its own reporter/runId/id instead
      // of the shared module-level globals.
      `const check_ = (passed, type, raw, reportLevel, title, details, actual, expected) => mmtHelper.check_(passed, type, raw, reportLevel, title, details, actual, expected, report_, console);\n` +
      // Override checkExpects_ with a closure-based version for parallel execution.
      `const checkExpects_ = (items, type, reportLevel, title, details) => mmtHelper.checkExpects_(items, type, reportLevel, title, details, report_, console);\n` +
      // Override checkAbort_ with a closure-based version so parallel tests
      // each check their own abort signal instead of the global.
      `const checkAbort_ = () => { if (__abortSignal && __abortSignal.aborted) { const e = new Error('Test run was stopped'); e.name = 'TestAbortError'; throw e; } };\n` +
      // Override importJsModule_ with a closure-based wrapper that ensures
      // the file loader is set to this test's loader before each import,
      // protecting against parallel tests overwriting the global loader.
      `const importJsModule_ = async (path, opts) => {` +
      `  if (__fileLoader && mmtHelper.setFileLoader_) { mmtHelper.setFileLoader_(__fileLoader); }` +
      `  return mmtHelper.importJsModule_(path, opts);` +
      `};\n` +
      `${code}`;
    let fn = compiledFunctionCache.get(functionBody);
    if (!fn) {
      fn = new Function(
        'mmtHelper', 'console', 'send_', 'sendGrpc_', 'extractOutputs_', 'Random',
        '__reporter', '__runId', '__id', '__mmt_random', '__mmt_current',
        '__mmt_access', '__abortSignal', '__fileLoader',
        functionBody);
      if (compiledFunctionCache.size >= MAX_COMPILED_FUNCTION_CACHE_SIZE) {
        const firstKey = compiledFunctionCache.keys().next().value;
        if (firstKey) {
          compiledFunctionCache.delete(firstKey);
        }
      }
      compiledFunctionCache.set(functionBody, fn);
    }
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
    // Create gRPC sender (lazy-loads grpcCore)
    const sendGrpcFn = async (req: GrpcRequest): Promise<GrpcResponse> => {
      const {sendGrpcRequest} = await import('./grpcCore.js');
      const config = getRunnerNetworkConfig();
      const loader = context.fileLoader || (async () => { throw new Error('File loader not available'); });
      return sendGrpcRequest(req, config, loader, context.basePath);
    };
    const returnValue = await fn(
        mmtHelper, customConsole, sendFn, sendGrpcFn, extractOutputs, Random,
        reporterFn, runId, context.id, mmtRandom, mmtCurrent, mmtAccess,
        context.abortSignal, context.fileLoader);
    restoreReporterGlobals();
    const elapsed = Date.now() - startTime;
    lg('debug', `Test ${title ? title + ' ' : ''}finished in ${elapsed} ms`);
    return returnValue;
  } catch (e: any) {
    // Suppress noisy error logging for intentional abort.
    const isAbort = e?.name === 'TestAbortError';
    if (!isAbort) {
      lg('error', 'Error running test: ' + (e?.message || String(e)));
    }
    restoreReporterGlobals();
    const elapsed = Date.now() - startTime;
    lg('debug', `Test ${title ? title + ' ' : ''}finished in ${elapsed} ms`);
    if (isAbort) {
      throw e;
    }
    return undefined;
  } finally {
    // Only clear abort signal if this run owns it.  During parallel suite
    // execution (skipServerCleanup=true), clearing unconditionally would
    // remove the signal for concurrent tests that share the global.
    if (!context.skipServerCleanup) {
      if ('setAbortSignal_' in mmtHelper && typeof (mmtHelper as any).setAbortSignal_ === 'function') {
        (mmtHelper as any).setAbortSignal_(undefined);
      }
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