

import {MMTFile} from './CommonData';

export type Timestr = `${number}s`|`${number}m`|`${number}h`|'inf';
export type Repeat = `${number}`|'inf';
export type Parameter = {
  [key: string]: string
};
export type Comparison = string;

export interface TestImportItem {
  [key: string]: string;
}

export interface TestMetric {
  repeat?: Repeat;
  threads?: number;
  duration?: Timestr;
  rampup?: Timestr;
}

export type FlowType = 'stages'|'steps'|'stage'|'step'|'call'|'check'|'assert'|'if'|'for'|
  'repeat'|'delay'|'js'|'print'|'end'|'set'|'var'|'const'|'let'|'data';

export interface TestFlowBase {
  type?: FlowType;
}

export interface TestFlowCall extends TestFlowBase {
  call: string;
  id: string;
  inputs?: Record<string, any>;
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
  delay: number | string;
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
  data: string; // alias of an imported CSV file
}
export type TestFlowStep = TestFlowCallTest|TestFlowCallAPI|TestFlowCheck|
  TestFlowAssert|TestFlowCondition|TestFlowRepeat|TestFlowLoop|TestFlowJS|
  TestFlowPrint|TestFlowDelay|TestFlowSet|TestFlowVar|TestFlowConst|TestFlowLet|TestFlowData;

export type TestFlowSteps = TestFlowStep[];

export type TestFlowStageId = string;

export interface TestFlowStage {
  id: TestFlowStageId;
  name?: string;
  steps: TestFlowSteps;
  condition?: Comparison;
  dependencies?: TestFlowStageId|TestFlowStageId[];
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
  'call', 'check', 'assert', 'if', 'for', 'repeat', 'delay', 'end', 'js', 'print', 'data', 'set',
  'var', 'const', 'let'
] as FlowType[];

// Flow types that the UI can add as individual steps/folders
export const addableFlowTypes = [
  'print', 'call', 'js', 'data', 'set', 'var', 'const', 'let',
  'check', 'if', 'for', 'repeat', 'delay', 'stage'
] as FlowType[];
export type CheckOps =
    '<'|'>'|'<='|'>='|'=='|'!='|'=@'|'!@'|'=^'|'!^'|'=$'|'!$'|'=~'|'!~';

export const opsList: CheckOps[] = [
  '<', '>', '<=', '>=', '==', '!=', '=@', '!@', '=^', '!^', '=$', '!$', '=~',
  '!~'
];

export const opsNames = [
  'less than', 'greater than', 'less or equal than', 'greater or equal than',
  'is equal', 'is not equal', 'is at', 'is not at', 'starts with',
  'not starts with', 'ends with', 'not ends with', 'regex match',
  'regex not match'
];