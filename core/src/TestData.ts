

import {MMTFile} from './CommonData';

export type Timestr = `${number}s`|`${number}m`|`${number}h`|'inf';
export type Repeat = `${number}`|'inf';
export type Parameter = {
  [key: string]: string
};
/** Report level for check/assert: 'all' (report pass+fail), 'fails' (fail only), 'none' (silent) */
export type ReportLevel = 'all' | 'fails' | 'none';

/** 
 * Report configuration for check/assert.
 * - internal: when running the test directly
 * - external: when the test is imported into another test file or added to a suite
 */
export interface ReportConfig {
  internal?: ReportLevel;
  external?: ReportLevel;
}

/**
 * Normalize report field from various formats:
 * - undefined → defaults
 * - string shorthand ('all'|'fails'|'none') → both internal and external same value
 * - object with internal/external
 */
export function normalizeReportConfig(
  report: ReportLevel | ReportConfig | undefined
): { internal: ReportLevel; external: ReportLevel } {
  const defaults = { internal: 'all' as ReportLevel, external: 'fails' as ReportLevel };
  if (!report) {
    return defaults;
  }
  if (typeof report === 'string') {
    return { internal: report, external: report };
  }
  return {
    internal: report.internal ?? defaults.internal,
    external: report.external ?? defaults.external,
  };
}

export interface ComparisonObject {
  actual: unknown;
  expected: unknown;
  operator?: string;
  title?: string;
  details?: string;
  report?: ReportLevel | ReportConfig;
}

export type Comparison = string | ComparisonObject;

/**
 * A single expect value: operator + expected (e.g. '== 200', '!= 500'),
 * or a plain value (defaults to == equality).
 */
export type ExpectValue = string | number | boolean;

/**
 * Map of output field names to expected values.
 * Each value can be a single ExpectValue or an array of ExpectValues
 * for multiple checks on the same field.
 * Examples:
 *   status_code: 200              → == 200 (default equality)
 *   status_code: == 200           → == 200
 *   status_code: [== 200, != 500] → two checks
 *   body.user.name: == John       → nested path access
 */
export type ExpectMap = Record<string, ExpectValue | ExpectValue[]>;

export interface TestImportItem {
  [key: string]: string;
}

export interface TestMetric {
  repeat?: Repeat;
  threads?: number;
  duration?: Timestr;
  rampup?: Timestr;
}

export type FlowType =
    'stages'|'steps'|'stage'|'step'|'call'|'run'|'check'|'assert'|'if'|'for'|'repeat'|
    'delay'|'js'|'print'|'end'|'set'|'var'|'const'|'let'|'data'|'setenv';

export interface TestFlowBase {
  type?: FlowType;
}

export interface TestFlowCall extends TestFlowBase {
  call: string;
  id: string;
  title?: string;
  inputs?: Record<string, any>;
  expect?: ExpectMap;
  debug?: ExpectMap | true;
  report?: ReportLevel | ReportConfig;
}

export interface TestFlowCallTest extends TestFlowCall {
  inputs?: Record<string, any>;
  outputs?: Record<string, any>;
}

export interface TestFlowCallAPI extends TestFlowCall {
  interface?: string;
  url?: string;
  headers?: Record<string, string>;
  inputs?: Record<string, any>;
  outputs?: Record<string, any>;
  body?: string;
}

export interface TestFlowCheck extends TestFlowBase {
  check: Comparison;
}
export interface TestFlowAssert extends TestFlowBase {
  assert: Comparison;
}

export interface TestFlowCondition extends TestFlowBase {
  if: Comparison;
  steps: TestFlowSteps;
  else?: TestFlowSteps;
}
export interface TestFlowRepeat extends TestFlowBase {
  repeat: number|string;
  steps: TestFlowSteps;
}
export interface TestFlowLoop extends TestFlowBase {
  for: Repeat|Timestr|string;
  steps: TestFlowSteps;
}
export interface TestFlowJS extends TestFlowBase {
  js: string
}
export interface TestFlowPrint extends TestFlowBase {
  print: string
}
export interface TestFlowDelay extends TestFlowBase {
  // delay duration: supports numbers (ms) or string with units: ns, ms, s, m, h
  delay: number|string;
}

export interface TestFlowSet extends TestFlowBase {
  set: Record<string, any>;
}
export interface TestFlowVar extends TestFlowBase {
  var : Record<string, any>;
}
export interface TestFlowConst extends TestFlowBase {
  const : Record<string, any>;
}
export interface TestFlowLet extends TestFlowBase {
  let : Record<string, any>;
}
export interface TestFlowData extends TestFlowBase {
  data: string;  // alias of an imported CSV file
}
export interface TestFlowSetEnv extends TestFlowBase {
  setenv: Record<string, any>;  // Maps env var names to output keys or literal values
}
export interface TestFlowRun extends TestFlowBase {
  run: string;  // alias of an imported server file
}
export type TestFlowStep = TestFlowCallTest|TestFlowCallAPI|TestFlowCheck|
    TestFlowAssert|TestFlowCondition|TestFlowRepeat|TestFlowLoop|TestFlowJS|
    TestFlowPrint|TestFlowDelay|TestFlowSet|TestFlowVar|TestFlowConst|
    TestFlowLet|TestFlowData|TestFlowSetEnv|TestFlowRun;

export type TestFlowSteps = TestFlowStep[];

export type TestFlowStageId = string;

export interface TestFlowStage {
  id: TestFlowStageId;
  title?: string;
  condition?: Comparison;
  after?: TestFlowStageId|TestFlowStageId[];
  steps: TestFlowSteps;
}

export type TestFlowStages = TestFlowStage[];

export interface TestDataBase extends MMTFile {
  title: string;
  tags: string[];
  description: string;
import?: Record<string, string>;
  inputs?: Record<string, string>;
  outputs?: Record<string, string>;
  metrics?: TestMetric;
  steps?: TestFlowSteps;
  stages?: TestFlowStages;
}

export interface TestDataSteps extends TestDataBase {
  steps?: TestFlowSteps;
}
export interface TestDataStages extends TestDataBase {
  stages?: TestFlowStages;
}

export type TestData = TestDataSteps|TestDataStages;

export const flowTypeOptions = [
  'call', 'run', 'check', 'assert', 'if', 'for', 'repeat', 'delay', 'end', 'js',
  'print', 'data', 'set', 'var', 'const', 'let', 'setenv'
] as FlowType[];

// Flow types that the UI can add as individual steps/folders
export const addableFlowTypes = [
  'print', 'call', 'run', 'js', 'set', 'var', 'const', 'let', 'assert', 'check', 'if',
  'for', 'repeat', 'delay', 'setenv', 'stage'
] as FlowType[];
export type CheckOps =
    '<'|'>'|'<='|'>='|'=='|'!='|'=@'|'!@'|'=^'|'!^'|'=$'|'!$'|'=~'|'!~';

export const opsList: CheckOps[] = [
  '<', '>', '<=', '>=', '==', '!=', '=@', '!@', '=^', '!^', '=$', '!$', '=~',
  '!~'
];

export const opsNames = [
  'less than', 'greater than', 'less than or equal', 'greater than or equal',
  'equal', 'not equal', 'contains', 'does not contain', 'starts with',
  'does not start with', 'ends with', 'does not end with', 'matches regex',
  'does not match regex'
];

export function getOpOptionLabel(op: CheckOps): string {
  const idx = opsList.indexOf(op);
  return idx >= 0 ? `${op} — ${opsNames[idx]}` : op;
}