import {flowTypeOptions, TestFlowHttp, TestFlowStep} from './TestData';

const JS_RESERVED = new Set([
  'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger', 'default',
  'delete', 'do', 'else', 'export', 'extends', 'false', 'finally', 'for', 'function',
  'if', 'import', 'in', 'instanceof', 'new', 'null', 'return', 'super', 'switch',
  'this', 'throw', 'true', 'try', 'typeof', 'var', 'void', 'while', 'with', 'yield',
  'let', 'static', 'enum', 'await', 'implements', 'interface', 'package', 'private',
  'protected', 'public', 'arguments', 'eval',
]);

const TEST_FLOW_KEYWORDS = new Set<string>(flowTypeOptions);

const MMT_STRUCTURE_KEYS = new Set([
  'type', 'title', 'description', 'tags', 'import', 'inputs', 'outputs', 'cache', 'setenv',
  'steps', 'stages', 'examples', 'protocol', 'format', 'method', 'url', 'query',
  'headers', 'cookies', 'body', 'auth', 'graphql', 'grpc', 'timeout', 'expect',
  'debug', 'report', 'then', 'else', 'items', 'variables', 'presets',
]);

const RUNTIME_GLOBALS = new Set([
  'console', 'JSON', 'Math', 'Object', 'Array', 'String', 'Number', 'Boolean',
  'Date', 'Promise', 'RegExp', 'Error', 'Map', 'Set', 'Symbol', 'BigInt',
  'parseInt', 'parseFloat', 'isNaN', 'isFinite', 'undefined', 'NaN', 'Infinity',
  'globalThis', 'window', 'document', 'process', 'module', 'require', 'exports',
]);

export function slugValue(value: string): string {
  return String(value || 'item')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'item';
}

export function slugToCamel(value: string): string {
  const parts = slugValue(value).split('-').filter(Boolean);
  const name = parts.map((part, index) => index === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)).join('');
  if (!name) {
    return 'request';
  }
  return /^[A-Za-z_]/.test(name) ? name : `request${name}`;
}

function needsIdentifierPrefix(name: string): boolean {
  if (!name) {
    return true;
  }
  const lower = name.toLowerCase();
  if (!/^[A-Za-z_$]/.test(name)) {
    return true;
  }
  if (/^[0-9]/.test(name)) {
    return true;
  }
  if (JS_RESERVED.has(lower) || JS_RESERVED.has(name)) {
    return true;
  }
  if (TEST_FLOW_KEYWORDS.has(lower)) {
    return true;
  }
  if (MMT_STRUCTURE_KEYS.has(lower)) {
    return true;
  }
  if (RUNTIME_GLOBALS.has(name)) {
    return true;
  }
  return false;
}

function withSafePrefix(name: string): string {
  if (!name) {
    return 'iRequest';
  }
  if (/^[A-Za-z_]/.test(name)) {
    return `i${name.charAt(0).toUpperCase()}${name.slice(1)}`;
  }
  return `i${name}`;
}

export function sanitizeStepId(value: string, fallback = 'request'): string {
  const normalized = String(value || '').trim().replace(/[^A-Za-z0-9_]/g, '_');
  if (!normalized) {
    return fallback;
  }
  return /^[A-Za-z_]/.test(normalized) ? normalized : `request_${normalized}`;
}

export function safeStepId(value: string, fallback = 'request'): string {
  const base = sanitizeStepId(value, fallback);
  return needsIdentifierPrefix(base) ? withSafePrefix(base) : base;
}

export function safeStepIdFromAlias(alias: string): string {
  if (!alias) {
    return 'iRequest';
  }
  return withSafePrefix(alias);
}

export function applyRunDebugToRequestSteps(steps: TestFlowStep[]): TestFlowStep[] {
  return steps.map(step => {
    if (step && typeof step === 'object' && 'http' in step) {
      return {...step as TestFlowHttp, debug: true};
    }
    return step;
  });
}
