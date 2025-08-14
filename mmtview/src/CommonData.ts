export type Type = "var" | "env" | "api" | "test" | null;

export type Protocol = "http" | "ws";
export type Format = "json" | "xml" | "text";
export type Method = "get" | "post" | "put" | "delete" | "patch" | "head" | "options" | "trace";

export const jsonTypes = [
  "object", "object[]", "string", "string[]", "number", "number[]", "boolean", "boolean[]"
];

export const typeOptions = [
  { value: "api", label: "API" },
  { value: "env", label: "Environment" },
  { value: "var", label: "Variables" },
  // { value: "test", label: "Test" }
];

export interface MMTFile {
  type: Type;
};

export type Parameter = { [key: string]: string | number | boolean };
export type JSONRecord = Record<string, string | number | boolean>;