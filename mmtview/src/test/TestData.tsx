

import { Type, Protocol, Method, Format } from "../CommonData"

export type Timestr = `${number}s` | `${number}m` | `${number}h` | "inf";
export type Repeat = `${number}` | "inf";
export type Parameter = { [key: string]: string };
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

export interface TestFlowCallTest {
  call: string;
  interface?: string;
  endpoint?: string;
  headers?: Record<string, string>;
  inputs?: Record<string, any>;
  outputs?: Record<string, any>;
  body?: string;
}

export interface TestFlowCallAPI {
  call: string;
  interface?: string;
  endpoint?: string;
  headers?: Record<string, string>;
  inputs?: Record<string, any>;
  outputs?: Record<string, any>;
  body?: string;
}

export interface TestFlowCallDirect {
  call: null;
  protocol: Protocol;
  format: Format;
  endpoint: string;
  method?: Method;
  headers?: Record<string, string>;
  body?: string | object;
  query?: Record<string, string>;
  params?: Record<string, string>;
  cookies?: Record<string, string>;
}

export interface TestFlowCheck {
  check: Comparison;
}

export interface TestFlowCondition {
  condition: Comparison;
}

export interface TestFlowLoop {
  loop: Repeat | Timestr | string;
}

export type End = null;

export type TestFlowStep = TestFlowCallTest | TestFlowCallDirect | TestFlowCallAPI | TestFlowCheck | TestFlowCondition | TestFlowLoop | End;

export type TestFlowSteps = TestFlowStep[];
export interface TestData {
  type: Type;
  title: string;
  tags: string[];
  description: string;
  import?: Parameter[];
  inputs?: Parameter[];
  outputs?: Parameter[];
  metrics?: TestMetric;
  flow?: TestFlowStep[];
}

export type FlowType = "call" | "check" | "condition" | "loop" | "end";

export const flowTypeOptions = [
  "call", "check", "condition", "loop", "end"
];