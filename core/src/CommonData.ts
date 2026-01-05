export type Type = "var" | "env" | "api" | "test" | "suite" | "doc" | "csv" | null;

export type Protocol = "http" | "ws";
export type Format = "json" | "xml" | "text";
export type Method = "get" | "post" | "put" | "delete" | "patch" | "head" | "options" | "trace";

export const jsonTypes = [
  "object", "object[]", "string", "string[]", "number", "number[]", "boolean", "boolean[]"
];

export const typeOptions = [
  { value: "api", label: "API" },
  { value: "env", label: "Environment" },
  { value: "test", label: "Test" },
  { value: "suite", label: "Suite" },
  { value: "doc", label: "Documentation" }
];

export interface MMTFile {
  type: Type;
};

export type JSONValue =  string | number | boolean | object | null;
export type Parameter = { [key: string]: JSONValue };
export type JSONRecord = Record<string, JSONValue>;

export type LogLevel = 'trace' | 'debug' | 'error' | 'warn' | 'info' | 'log';
