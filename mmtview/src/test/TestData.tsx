

import { MMTFile, Protocol, Method, Format } from "../CommonData"

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
  target: string;
  inputs?: Record<string, any>;
  outputs?: Record<string, any>;
}

export interface TestFlowCallAPI {
  target: string;
  interface?: string;
  url?: string;
  headers?: Record<string, string>;
  inputs?: Record<string, any>;
  outputs?: Record<string, any>;
  body?: string;
}

export interface TestFlowCallHTTP {
  target: "http";
  protocol: Protocol;
  format: Format;
  url: string;
  method?: Method;
  headers?: Record<string, string>;
  body?: string | object;
  query?: Record<string, string>;
  cookies?: Record<string, string>;
}

export interface TestFlowCallWS {
  target: "ws";
  format: Format;
  url: string
  body?: string | object;
}

export interface TestFlowCheck {
  check: Comparison;
}

export interface TestFlowCondition {
  if: Comparison;
}

export interface TestFlowLoop {
  for: Repeat | Timestr | string;
}

export type End = null;

export type TestFlowStep = TestFlowCallTest | TestFlowCallWS  | TestFlowCallHTTP | TestFlowCallAPI | TestFlowCheck | TestFlowCondition | TestFlowLoop | End;

export type TestFlowSteps = TestFlowStep[];

export interface TestData extends MMTFile {
  title: string;
  tags: string[];
  description: string;
  import?: Parameter[];
  inputs?: Parameter[];
  outputs?: Parameter[];
  metrics?: TestMetric;
  flow?: TestFlowStep[];
}

export type FlowType = "call" | "check" | "if" | "for" | "end";

export const flowTypeOptions = [
  "call", "check", "if", "for", "end"
];

export type CheckOps = "<" | ">" | "<=" | ">=" | "=" | "!=" | "=@" | "!@" | "^" | "!^" | "$" | "!$" | "=~" | "!~";

export const opsList: CheckOps[] = [
  "<", ">", "<=", ">=", "=", "!=", "=@", "!@", "^", "!^", "$", "!$", "=~", "!~"
];

export const opsNames = [
  "less than", "greater than", "less or equal than", "greater or equal than", "is equal", "is not equal", "is at", "is not at", "starts with", "not starts with", "ends with", "not ends with", "regex match", "regex not match"
];