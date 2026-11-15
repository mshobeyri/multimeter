import YAML from 'yaml';

export type TelemetryFileType = 'api'|'test'|'suite'|'env'|'other';
export type TelemetryProtocol = 'http'|'ws'|'grpc'|'graphql'|'other';
export type TelemetryAuthKind = 'none'|'bearer'|'basic'|'cert'|'apikey'|'oauth2'|'other';
export type TelemetryExtractKind = 'none'|'jsonpath'|'xpath'|'regex'|'other';
export type TelemetryComplexity = 'basic'|'standard';

export type FeatureFlags = {
  fileType: TelemetryFileType;
  protocol: TelemetryProtocol;
  hasInputs: boolean;
  hasEnv: boolean;
  hasOutputs: boolean;
  hasBody: boolean;
  hasHeaders: boolean;
  hasQuery: boolean;
  authKind: TelemetryAuthKind;
  extractKind: TelemetryExtractKind;
  usesExpect: boolean;
  usesCheck: boolean;
  usesRandom: boolean;
  usesCurrent: boolean;
  usesCapture: boolean;
  usesImport: boolean;
  assertCountBucket: '0'|'1'|'2-5'|'6+';
  stepCountBucket: '1'|'2-5'|'6-20'|'21+';
  itemCountBucket: '1'|'2-5'|'6-20'|'21+';
  complexity: TelemetryComplexity;
};

const EMPTY: FeatureFlags = {
  fileType: 'other',
  protocol: 'http',
  hasInputs: false,
  hasEnv: false,
  hasOutputs: false,
  hasBody: false,
  hasHeaders: false,
  hasQuery: false,
  authKind: 'none',
  extractKind: 'none',
  usesExpect: false,
  usesCheck: false,
  usesRandom: false,
  usesCurrent: false,
  usesCapture: false,
  usesImport: false,
  assertCountBucket: '0',
  stepCountBucket: '1',
  itemCountBucket: '1',
  complexity: 'basic',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function nonEmptyRecord(value: unknown): boolean {
  return isRecord(value) && Object.keys(value).length > 0;
}

function nonEmptyValue(value: unknown): boolean {
  if (value === null || value === undefined) {
    return false;
  }
  if (typeof value === 'string') {
    return value.trim().length > 0;
  }
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  if (isRecord(value)) {
    return Object.keys(value).length > 0;
  }
  return true;
}

function bucketCount(n: number): '0'|'1'|'2-5'|'6+' {
  if (n <= 0) {
    return '0';
  }
  if (n === 1) {
    return '1';
  }
  if (n <= 5) {
    return '2-5';
  }
  return '6+';
}

function bucketSteps(n: number): '1'|'2-5'|'6-20'|'21+' {
  if (n <= 1) {
    return '1';
  }
  if (n <= 5) {
    return '2-5';
  }
  if (n <= 20) {
    return '6-20';
  }
  return '21+';
}

function normalizeFileType(raw: unknown): TelemetryFileType {
  const t = String(raw || '').trim().toLowerCase();
  if (t === 'api' || t === 'test' || t === 'suite' || t === 'env') {
    return t;
  }
  return 'other';
}

function normalizeProtocol(doc: Record<string, unknown>): TelemetryProtocol {
  const raw = String(doc.protocol || '').trim().toLowerCase();
  if (raw === 'websocket' || raw === 'ws') {
    return 'ws';
  }
  if (raw === 'grpc') {
    return 'grpc';
  }
  if (raw === 'graphql') {
    return 'graphql';
  }
  if (raw === 'http' || raw === 'https' || !raw) {
    if (isRecord(doc.graphql)) {
      return 'graphql';
    }
    if (isRecord(doc.grpc)) {
      return 'grpc';
    }
    return 'http';
  }
  return 'other';
}

function normalizeAuthKind(auth: unknown): TelemetryAuthKind {
  if (!nonEmptyValue(auth)) {
    return 'none';
  }
  if (typeof auth === 'string') {
    const s = auth.trim().toLowerCase();
    if (!s || s === 'none') {
      return 'none';
    }
    if (s.includes('bearer')) {
      return 'bearer';
    }
    if (s.includes('basic')) {
      return 'basic';
    }
    if (s.includes('cert') || s.includes('mtls')) {
      return 'cert';
    }
    if (s.includes('apikey') || s.includes('api-key') || s.includes('api_key')) {
      return 'apikey';
    }
    if (s.includes('oauth')) {
      return 'oauth2';
    }
    return 'other';
  }
  if (isRecord(auth)) {
    const type = String(auth.type || auth.kind || '').trim().toLowerCase();
    if (!type || type === 'none') {
      if (auth.bearer || auth.token) {
        return 'bearer';
      }
      if (auth.username || auth.password || auth.basic) {
        return 'basic';
      }
      if (auth.cert || auth.certificate || auth.pfx) {
        return 'cert';
      }
      if (auth.apikey || auth.apiKey || auth.key) {
        return 'apikey';
      }
      return Object.keys(auth).length > 0 ? 'other' : 'none';
    }
    if (type.includes('bearer')) {
      return 'bearer';
    }
    if (type.includes('basic')) {
      return 'basic';
    }
    if (type.includes('cert') || type.includes('mtls')) {
      return 'cert';
    }
    if (type.includes('apikey') || type.includes('api-key') || type.includes('api_key')) {
      return 'apikey';
    }
    if (type.includes('oauth')) {
      return 'oauth2';
    }
    return 'other';
  }
  return 'other';
}

function classifyExtract(expr: unknown): TelemetryExtractKind {
  if (typeof expr !== 'string') {
    return 'other';
  }
  const s = expr.trim();
  if (!s) {
    return 'other';
  }
  if (s.startsWith('/') && s.lastIndexOf('/') > 0 || /\(\?[^)]*\)/.test(s) ||
      /^regex\b/i.test(s)) {
    return 'regex';
  }
  if (/^xpath\b/i.test(s) || s.startsWith('//') || /^\/[a-zA-Z*]/.test(s)) {
    return 'xpath';
  }
  if (/^(body|header|headers|status|details|duration|cookies|message|metadata)\b/i.test(s) ||
      s.includes('.') || s.includes('[')) {
    return 'jsonpath';
  }
  return 'other';
}

function extractKindFromOutputs(outputs: unknown): TelemetryExtractKind {
  if (!isRecord(outputs) || Object.keys(outputs).length === 0) {
    return 'none';
  }
  let kind: TelemetryExtractKind = 'other';
  for (const value of Object.values(outputs)) {
    const next = classifyExtract(value);
    if (next === 'regex') {
      return 'regex';
    }
    if (next === 'xpath') {
      kind = 'xpath';
    } else if (next === 'jsonpath' && kind !== 'xpath') {
      kind = 'jsonpath';
    } else if (kind === 'other') {
      kind = next;
    }
  }
  return kind;
}

function countAssertLike(node: unknown, acc = {expect: 0, check: 0, assert: 0}):
    {expect: number; check: number; assert: number} {
  if (Array.isArray(node)) {
    for (const item of node) {
      countAssertLike(item, acc);
    }
    return acc;
  }
  if (!isRecord(node)) {
    return acc;
  }
  if (node.expect !== undefined || node.softExpect !== undefined) {
    acc.expect += 1;
  }
  if (node.check !== undefined) {
    acc.check += 1;
  }
  if (node.assert !== undefined) {
    acc.assert += 1;
  }
  for (const value of Object.values(node)) {
    if (value && typeof value === 'object') {
      countAssertLike(value, acc);
    }
  }
  return acc;
}

function countSteps(doc: Record<string, unknown>): number {
  const steps = doc.steps || doc.then || doc.flow;
  if (Array.isArray(steps)) {
    return steps.length;
  }
  if (isRecord(steps)) {
    return Object.keys(steps).length;
  }
  return 0;
}

function countSuiteItems(doc: Record<string, unknown>): number {
  const items = doc.items || doc.tests || doc.suites || doc.then;
  if (Array.isArray(items)) {
    return items.length;
  }
  if (isRecord(items)) {
    return Object.keys(items).length;
  }
  return 0;
}

function hasImport(doc: Record<string, unknown>, raw: string): boolean {
  if (nonEmptyValue(doc.import) || nonEmptyValue(doc.imports)) {
    return true;
  }
  return /(?:^|\n)\s*(?:import|imports)\s*:/m.test(raw) || /\+\//.test(raw);
}

function boolPropsForComplexity(flags: FeatureFlags): boolean {
  return flags.hasInputs || flags.hasEnv || flags.hasOutputs ||
      flags.usesExpect || flags.usesCheck || flags.extractKind !== 'none' ||
      flags.usesImport || flags.usesRandom || flags.usesCurrent ||
      flags.usesCapture || flags.authKind !== 'none' ||
      flags.assertCountBucket !== '0';
}

/**
 * Derive anonymous feature flags from .mmt YAML. Never returns values/names.
 */
export function analyzeMmtFeatures(rawFile: string): FeatureFlags {
  const raw = typeof rawFile === 'string' ? rawFile : '';
  let doc: Record<string, unknown> = {};
  try {
    const parsed = YAML.parse(raw);
    if (isRecord(parsed)) {
      doc = parsed;
    }
  } catch {
    // Fall back to token/regex signals only.
  }

  const fileType = normalizeFileType(doc.type);
  const asserts = countAssertLike(doc);
  const assertTotal = asserts.expect + asserts.check + asserts.assert;
  const stepCount = countSteps(doc);
  const itemCount = countSuiteItems(doc);

  const flags: FeatureFlags = {
    ...EMPTY,
    fileType,
    protocol: fileType === 'api' ? normalizeProtocol(doc) : 'http',
    hasInputs: nonEmptyRecord(doc.inputs) ||
        (Array.isArray(doc.inputs) && doc.inputs.length > 0),
    hasEnv: nonEmptyValue(doc.env) || nonEmptyValue(doc.environment) ||
        /(?:^|[^\w])e:[A-Za-z_][\w-]*/.test(raw) ||
        /<<\s*e:[^>]+>>/.test(raw) || /\{\{\s*e:[^}]+\}\}/.test(raw),
    hasOutputs: nonEmptyRecord(doc.outputs) || nonEmptyRecord(doc.setenv),
    hasBody: nonEmptyValue(doc.body),
    hasHeaders: nonEmptyRecord(doc.headers) || nonEmptyRecord(doc.header),
    hasQuery: nonEmptyRecord(doc.query) || nonEmptyRecord(doc.params) ||
        nonEmptyRecord(doc.param),
    authKind: normalizeAuthKind(doc.auth),
    extractKind: (() => {
      const fromOutputs = extractKindFromOutputs(doc.outputs);
      if (fromOutputs !== 'none') {
        return fromOutputs;
      }
      return extractKindFromOutputs(doc.setenv);
    })(),
    usesExpect: asserts.expect > 0 || /\bexpect\s*:/.test(raw),
    usesCheck: asserts.check > 0 || /\bcheck\s*:/.test(raw),
    usesRandom: /(?:^|[^\w])r:[A-Za-z_]/.test(raw) || /<<\s*r:/.test(raw) ||
        /\{\{\s*r:/.test(raw),
    usesCurrent: /(?:^|[^\w])c:[A-Za-z_]/.test(raw) || /<<\s*c:/.test(raw) ||
        /\{\{\s*c:/.test(raw),
    usesCapture: /\bcapture\s*:/.test(raw),
    usesImport: hasImport(doc, raw),
    assertCountBucket: bucketCount(assertTotal),
    stepCountBucket: bucketSteps(Math.max(1, stepCount)),
    itemCountBucket: bucketSteps(Math.max(1, itemCount)),
    complexity: 'basic',
  };

  // Manual / runtime inputs from the UI also count.
  flags.complexity = boolPropsForComplexity(flags) ? 'standard' : 'basic';
  return flags;
}

export function withRuntimeInputs(
    flags: FeatureFlags, manualInputs?: Record<string, unknown>|null): FeatureFlags {
  if (!manualInputs || Object.keys(manualInputs).length === 0) {
    return flags;
  }
  const next = {...flags, hasInputs: true};
  next.complexity = boolPropsForComplexity(next) ? 'standard' : 'basic';
  return next;
}

export function boolString(value: boolean): 'true'|'false' {
  return value ? 'true' : 'false';
}
