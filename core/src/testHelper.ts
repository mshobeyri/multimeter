/**
 * Abort signal for cooperative test cancellation.
 * Set via setAbortSignal_ before each run, checked by checkAbort_
 * which is injected between test steps.
 */
let __mmtAbortSignal: AbortSignal|undefined;

export class TestAbortError extends Error {
  constructor() {
    super('Test run was stopped');
    this.name = 'TestAbortError';
  }
}

export const setAbortSignal_ = (signal: AbortSignal|undefined) => {
  __mmtAbortSignal = signal;
};

export const checkAbort_ = () => {
  if (__mmtAbortSignal?.aborted) {
    throw new TestAbortError();
  }
};

export function less_(a: any, b: any) {
  return a < b;
}

export function greater_(a: any, b: any) {
  return a > b;
}

export function lessOrEqual_(a: any, b: any) {
  return a <= b;
}

export function greaterOrEqual_(a: any, b: any) {
  return a >= b;
}

export function equals_(a: any, b: any) {
  return a === b;
}

export function notEquals_(a: any, b: any) {
  return a !== b;
}

export function isAt_(a: any, b: any) {
  // Checks if a is in b (for strings or arrays)
  if (typeof b === 'string' || Array.isArray(b)) {
    return b.includes(a);
  }
  return false;
}

export function isNotAt_(a: any, b: any) {
  if (typeof b === 'string' || Array.isArray(b)) {
    return !b.includes(a);
  }
  return true;
}

export function matches_(a: any, b: any) {
  // b is a regex string, e.g. "^foo.*"
  try {
    const re = new RegExp(b);
    return re.test(a);
  } catch {
    return false;
  }
}

export function notMatches_(a: any, b: any) {
  try {
    const re = new RegExp(b);
    return !re.test(a);
  } catch {
    return true;
  }
}

export function startsWith_(a: any, b: any) {
  if (typeof a === 'string' && typeof b === 'string') {
    return a.startsWith(b);
  }
  return false;
}

export function notStartsWith_(a: any, b: any) {
  if (typeof a === 'string' && typeof b === 'string') {
    return !a.startsWith(b);
  }
  return true;
}

export function endsWith_(a: any, b: any) {
  if (typeof a === 'string' && typeof b === 'string') {
    return a.endsWith(b);
  }
  return false;
}

export function notEndsWith_(a: any, b: any) {
  if (typeof a === 'string' && typeof b === 'string') {
    return !a.endsWith(b);
  }
  return true;
}

type FileLoader = (path: string) => Promise<string>;

let __mmtFileLoader: FileLoader|undefined;
const __mmtJsModuleCache = new Map<string, any>();

export const setFileLoader_ = (loader: FileLoader|undefined) => {
  __mmtFileLoader = loader;
};

export const importJsModule_ = async(
    resolvedPath: string,
    options?: {
      moduleId?: string;
      forceReload?: boolean;
    }): Promise<any> => {
  const path = String(resolvedPath ?? '');
  if (!path) {
    throw new Error('importJsModule_: empty path');
  }
  const forceReload = options?.forceReload === true;
  if (!forceReload && __mmtJsModuleCache.has(path)) {
    return __mmtJsModuleCache.get(path);
  }
  if (typeof __mmtFileLoader !== 'function') {
    throw new Error(
        'importJsModule_: fileLoader is not available in this runtime');
  }
  const source = await __mmtFileLoader(path);
  const sourceText = String(source ?? '');
  if (!sourceText.trim()) {
    throw new Error(`importJsModule_: empty module source for ${path}`);
  }
  const moduleObj: {exports: any} = {exports: {}};
  const moduleId = options?.moduleId || path;

  // Evaluate as CommonJS-like module.
  // Note: This intentionally does not expose Node's require/process.
    // Evaluate as CommonJS-like module.
    // We keep exports in sync with module.exports even if reassigned.
    const wrapped =
      `"use strict";\n` +
      `let exports = module.exports;\n` +
      `${sourceText}\n` +
      `return module.exports;\n`;
    const fn = new Function('module', '__filename', '__dirname', wrapped);
    const exported = fn(moduleObj, moduleId, '');

    // If the module reassigned module.exports, ensure our stored reference matches.
    moduleObj.exports = exported;

  __mmtJsModuleCache.set(path, exported);
  return exported;
};
declare const __mmtReportStep:|((event: Record<string, any>) => void)|undefined;
declare const __mmtRunId: string|undefined;
declare const __mmtId: string|undefined;

type StepType = 'check'|'assert';

const resolveReporter = () =>
    (typeof __mmtReportStep === 'function' ? __mmtReportStep : undefined);

const ensurePayload = (event: Record<string, any>): Record<string, any> => {
  const payload = {...event};
  if (typeof payload.timestamp !== 'number') {
    payload.timestamp = Date.now();
  }
  if (!payload.runId) {
    payload.runId = typeof __mmtRunId === 'string' ? __mmtRunId : '';
  }
  if (!payload.id && typeof __mmtId === 'string') {
    payload.id = __mmtId;
  }
  return payload;
};

let lastRunId: string|undefined;
let stepIndex = 0;
const stepIndexByRunId = new Map<string, number>();
const nextStepIndex = (): number => {
  const currentRunId = typeof __mmtRunId === 'string' ? __mmtRunId : '';
  if (currentRunId !== lastRunId) {
    lastRunId = currentRunId;
    stepIndex = 0;
    // Don't clear the map — other parallel tests may still be using their
    // entries.  The map is keyed by runId so stale entries from finished
    // runs are harmless and will be overwritten on the next suite run.
  }
  stepIndex += 1;
  return stepIndex;
};

const nextStepIndexFor = (runId: string): number => {
  if (!runId) {
    return nextStepIndex();
  }
  const current = stepIndexByRunId.get(runId) || 0;
  const next = current + 1;
  stepIndexByRunId.set(runId, next);
  return next;
};

const normalizeComparison = (value: unknown): string => {
  if (typeof value === 'string') {
    return value;
  }
  if (value === null || value === undefined) {
    return '';
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

const normalizeMessage = (value: unknown): string|undefined => {
  if (typeof value === 'string') {
    return value;
  }
  return undefined;
};

const normalizeTitleDetails = (title: unknown, details: unknown): {
  title?: string;
  details?: string;
} => {
  const t = normalizeMessage(title);
  const d = normalizeMessage(details);
  return {
    title: t,
    details: d,
  };
};

const emitStep = (event: Record<string, any>) => {
  const reporter = resolveReporter();
  if (!reporter) {
    // No reporter — silently skip. This is normal for plain CLI runs
    // where no webview or test framework is listening for step events.
    return;
  }
  try {
    reporter(ensurePayload(event));
  } catch {
    // Ignore reporter errors so tests keep running
  }
};

export const report_ = (
    stepType: StepType, comparison: unknown, title: unknown,
    details: unknown, passed: boolean, actual?: any, expected?: any) => {
  reportWithContext_(undefined, undefined, undefined, stepType, comparison, title, details, passed, actual, expected);
};

export const reportWithContext_ = (
    reporter: ((event: Record<string, any>) => void)|undefined,
    runId: string|undefined,
    id: string|undefined,
    stepType: StepType, comparison: unknown, title: unknown,
    details: unknown, passed: boolean, actual?: any, expected?: any) => {
  const resolvedRunId = typeof runId === 'string' ? runId : '';

  // Build the expects array: either from an array (batched expects) or a
  // single comparison string (regular check/assert).
  const isExpectsArray = Array.isArray(comparison);
  const expects = isExpectsArray
      ? (comparison as any[]).map(i => ({
          comparison: normalizeComparison(i.comparison),
          actual: i.actual,
          expected: i.expected,
          status: i.passed ? 'passed' : 'failed',
        }))
      : [{
          comparison: normalizeComparison(comparison),
          actual,
          expected,
          status: passed ? 'passed' : 'failed',
        }];

  const payload: Record<string, any> = {
    scope: 'test-step',
    stepType,
    stepIndex: runId !== undefined ? nextStepIndexFor(resolvedRunId) : nextStepIndex(),
    status: passed ? 'passed' : 'failed',
    expects,
  };
  if (resolvedRunId) {
    payload.runId = resolvedRunId;
  }

  const normalized = normalizeTitleDetails(title, details);
  if (typeof normalized.title === 'string') {
    payload.title = normalized.title;
  }
  if (typeof normalized.details === 'string') {
    payload.details = normalized.details;
  }

  const resolvedId = (typeof id === 'string' && id) ? id :
      (typeof __mmtId === 'string' && __mmtId) ? __mmtId : undefined;
  if (resolvedId) {
    payload.id = resolvedId;
  }

  if (typeof reporter === 'function') {
    try {
      reporter(ensurePayload(payload));
    } catch {
      // Ignore reporter errors so tests keep running
    }
    return;
  }

  emitStep(payload);
};

export const setenv_ = (name: string, value: any) => {
  setenvWithContext_(undefined, undefined, undefined, name, value);
};

export const setenvWithContext_ = (
    reporter: ((event: Record<string, any>) => void)|undefined,
    runId: string|undefined,
    id: string|undefined,
    name: string, value: any) => {
  const resolvedRunId = typeof runId === 'string' ? runId : '';
  const payload: Record<string, any> = {
    scope: 'setenv',
    name,
    value,
  };
  if (resolvedRunId) {
    payload.runId = resolvedRunId;
  }

  const resolvedId = (typeof id === 'string' && id) ? id :
      (typeof __mmtId === 'string' && __mmtId) ? __mmtId : undefined;
  if (resolvedId) {
    payload.id = resolvedId;
  }

  if (typeof reporter === 'function') {
    try {
      reporter(ensurePayload(payload));
    } catch {
      // Ignore reporter errors so tests keep running
    }
    return;
  }

  emitStep(payload);
};

/**
 * Server runner callback type.
 * Returns a cleanup function that stops the server when called.
 */
export type ServerRunner = (alias: string, filePath: string) => Promise<() => void>;

let __mmtServerRunner: ServerRunner | undefined;
const __mmtStartedServers = new Map<string, () => void>();

export const setServerRunner_ = (runner: ServerRunner | undefined) => {
  __mmtServerRunner = runner;
};

/**
 * Start a mock server by alias. The alias must correspond to an imported server file.
 * If the server is already running, this is a no-op.
 */
export const startServer_ = async (alias: string): Promise<void> => {
  if (__mmtStartedServers.has(alias)) {
    // Server already running, idempotent
    return;
  }
  if (!__mmtServerRunner) {
    throw new Error(`Cannot start server "${alias}": no server runner configured`);
  }
  // The alias needs to be resolved to a file path by the generated code
  // For now, we pass the alias directly; the serverRunner implementation
  // should have access to the import map to resolve it
  const cleanup = await __mmtServerRunner(alias, alias);
  __mmtStartedServers.set(alias, cleanup);
};

/**
 * Register a server that was started externally (e.g. suite-level servers).
 * This prevents `startServer_` from trying to start a duplicate.
 * @param alias The server alias/path
 * @param cleanup The cleanup function to stop the server
 */
export const registerServer_ = (alias: string, cleanup: () => void): void => {
  __mmtStartedServers.set(alias, cleanup);
};

/**
 * Stop all servers started during this test run.
 */
export const stopAllServers_ = (): void => {
  for (const [alias, cleanup] of __mmtStartedServers) {
    try {
      cleanup();
    } catch {
      // Ignore cleanup errors
    }
  }
  __mmtStartedServers.clear();
};

/**
 * Check if a server is running by alias.
 */
export const isServerRunning_ = (alias: string): boolean => {
  return __mmtStartedServers.has(alias);
};

/**
 * Infer the network protocol from a URL string.
 * Returns 'ws' for WebSocket URLs (ws:// or wss://), 'http' otherwise.
 */
export const protocolFromUrl_ = (url: string): string => {
  const t = (url || '').trim().toLowerCase();
  return t.startsWith('ws://') || t.startsWith('wss://') ? 'ws' : 'http';
};

/**
 * Format check/assert details for readable log output.
 * Tries to parse as JSON and pretty-print, recursively expanding any
 * string values that are themselves JSON.  Falls back to the raw string
 * if parsing fails.
 */

function displayValue(v: any): string {
  if (v === null || v === undefined) {
    return String(v);
  }
  if (typeof v === 'object') {
    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  }
  return String(v);
}

function formatCheckDetails(raw: string): string {
  try {
    const expandJsonStrings = (obj: any): any => {
      if (typeof obj === 'string') {
        const trimmed = obj.trim();
        if ((trimmed.startsWith('{') && trimmed.endsWith('}')) ||
            (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
          try {
            return expandJsonStrings(JSON.parse(trimmed));
          } catch {
            return obj;
          }
        }
        return obj;
      }
      if (Array.isArray(obj)) {
        return obj.map(expandJsonStrings);
      }
      if (obj && typeof obj === 'object') {
        const result: Record<string, any> = {};
        for (const [k, v] of Object.entries(obj)) {
          result[k] = expandJsonStrings(v);
        }
        return result;
      }
      return obj;
    };
    const parsed = JSON.parse(raw);
    const expanded = expandJsonStrings(parsed);
    return JSON.stringify(expanded, null, 2);
  } catch {
    return raw;
  }
}

/**
 * Unified check/assert helper. Handles logging, reporting, and throwing.
 *
 * @param passed    - result of the comparison (e.g. equals_(...))
 * @param type      - 'check' or 'assert'
 * @param raw       - the expression string, e.g. "foo == bar"
 * @param reportLevel - 'all' | 'fails' | 'none'
 * @param title     - optional check title
 * @param details   - optional details string
 * @param actual    - runtime actual value (for reporting and fail message)
 * @param expected  - runtime expected value (for reporting and fail message)
 * @param reportFn  - optional report function override (used by suite parallel
 *                    execution to inject a closure-based reporter instead of
 *                    relying on the module-level report_ which uses globals)
 */
export const check_ = (
    passed: boolean,
    type: 'check' | 'assert',
    raw: string,
    reportLevel: string,
    title?: string,
    details?: string,
    actual?: any,
    expected?: any,
    reportFn?: (...args: any[]) => void,
    consoleFn?: {log: (...a: any[]) => void; debug: (...a: any[]) => void; error: (...a: any[]) => void; trace: (...a: any[]) => void},
): void => {
  const doReport = typeof reportFn === 'function' ? reportFn : report_;
  const c = consoleFn || console;
  const label = type === 'check' ? 'Check' : 'Assert';
  const titlePart = title ? `"${title}" - ` : '';
  if (passed) {
    const msg = `\u2713 ${label} ${titlePart}"${raw}" passed`;
    if (reportLevel === 'all') {
      c.log(msg);
      doReport(type, raw, title, details, true);
    } else if (reportLevel === 'fails') {
      c.debug(msg);
    } else {
      // reportLevel === 'none'
      c.trace(msg);
    }
  } else {
    const shortMsg = `\u2717 ${label} ${titlePart}"${raw}" failed, as ${displayValue(actual)} is not ${displayValue(expected)}`;
    if (reportLevel === 'none') {
      c.debug(shortMsg);
    } else {
      c.error(shortMsg);
      if (details) {
        c.debug(formatCheckDetails(details));
      }
      doReport(type, raw, title, details, false, actual, expected);
    }
    if (type === 'assert') {
      throw new Error('Assertion failed');
    }
  }
};

/**
 * Batched expect check: evaluates a list of expect items and emits a single
 * report event with an `expects` array. The overall status is 'passed' only if
 * every individual item passes.
 *
 * @param items       - Array of { passed, comparison, actual, expected }
 * @param type        - 'check' (expects are non-throwing)
 * @param reportLevel - 'all' | 'fails' | 'none'
 * @param title       - shared title (typically the call name)
 * @param details     - shared details (typically the JSON result)
 * @param reportFn    - optional report function override
 * @param consoleFn   - optional console override
 */
export const checkExpects_ = (
    items: Array<{ passed: boolean; comparison: string; actual?: any; expected?: any }>,
    type: 'check' | 'assert',
    reportLevel: string,
    title?: string,
    details?: string,
    reportFn?: (...args: any[]) => void,
    consoleFn?: {log: (...a: any[]) => void; debug: (...a: any[]) => void; error: (...a: any[]) => void; trace: (...a: any[]) => void},
): void => {
  const doReport = typeof reportFn === 'function' ? reportFn : report_;
  const c = consoleFn || console;
  const label = type === 'check' ? 'Check' : 'Assert';
  const titlePart = title ? `"${title}" - ` : '';
  const allPassed = items.every(i => i.passed);

  // Log each individual item
  for (const item of items) {
    if (item.passed) {
      const msg = `\u2713 ${label} ${titlePart}"${item.comparison}" passed`;
      if (reportLevel === 'all') {
        c.log(msg);
      } else if (reportLevel === 'fails') {
        c.debug(msg);
      } else {
        c.trace(msg);
      }
    } else {
      const shortMsg = `\u2717 ${label} ${titlePart}"${item.comparison}" failed, as ${displayValue(item.actual)} is not ${displayValue(item.expected)}`;
      if (reportLevel === 'none') {
        c.debug(shortMsg);
      } else {
        c.error(shortMsg);
      }
    }
  }

  // Report as a single event
  if (allPassed) {
    if (reportLevel === 'all') {
      doReport(type, items, title, details, true);
    }
  } else {
    if (details && reportLevel !== 'none') {
      c.debug(formatCheckDetails(details));
    }
    if (reportLevel !== 'none') {
      doReport(type, items, title, details, false);
    }
    if (type === 'assert') {
      throw new Error('Assertion failed');
    }
  }
};