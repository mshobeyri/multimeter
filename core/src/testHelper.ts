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
    stepIndexByRunId.clear();
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
    console.log('No reporter available to emit step:', event);
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
  const payload: Record<string, any> = {
    scope: 'test-step',
    stepType,
    comparison: normalizeComparison(comparison),
    stepIndex: runId !== undefined ? nextStepIndexFor(resolvedRunId) : nextStepIndex(),
    status: passed ? 'passed' : 'failed',
    actual,
    expected,
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