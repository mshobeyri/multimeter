

import {MMTFile} from '../CommonData';

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

export type FlowType = 'call'|'check'|'if'|'for'|'repeat'|'end';

export interface TestFlowBase {
  type?: FlowType;
}

export interface TestFlowCall extends TestFlowBase {
  id: string;
  target: string;
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

export interface TestFlowCondition extends TestFlowBase {
  if: Comparison;
  steps: TestFlowSteps;
  else?: TestFlowSteps;
}
export interface TestFlowRepeat extends TestFlowBase {
  repeat: number;
  steps: TestFlowSteps;
}
export interface TestFlowLoop extends TestFlowBase {
  for: Repeat|Timestr|string;
  steps: TestFlowSteps;
}

export type TestFlowStep = TestFlowCallTest|TestFlowCallAPI|TestFlowCheck|
    TestFlowCondition|TestFlowRepeat|TestFlowLoop;

export type TestFlowSteps = TestFlowStep[];

export interface TestData extends MMTFile {
  title: string;
  tags: string[];
  description: string;
import?: Record<string, string>;
  inputs?: Record<string, string>;
  outputs?: Record<string, string>;
  metrics?: TestMetric;
  flow?: TestFlowSteps;
}

export const flowTypeOptions = ['call', 'check', 'if', 'for', 'repeat', 'end'];
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