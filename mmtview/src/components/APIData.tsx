import {Type} from "./CommonData"

export type Protocol = "http" | "ws";
export type Format = "json" | "xml";
export type Method = "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "HEAD" | "OPTIONS";

export const jsonTypes = [
  "object", "object[]", "string", "string[]", "number", "number[]", "boolean", "boolean[]"
];


export interface InterfaceData {
  name: string;
  protocol: Protocol;
  format: Format;
  endpoint: string;
  method?: Method;
  headers?: Record<string, string>;
  body?: string | object;
  query?: Record<string, string>;
  params?: Record<string, string>;
  cookies?: Record<string, string>;
  outputs?: Record<string, string | { [format: string]: string }>;
}

export type Parameter = { [key: string]: string };

export interface ExampleData {
  name: string;
  description?: string;
  inputs?: Parameter[];
}

export interface APIData {
  type: Type;
  title?: string;
  tags?: string[];
  description?: string;
  import?: Parameter[];
  inputs?: Parameter[];
  outputs?: Parameter[];
  interfaces?: Array<InterfaceData>;
  examples?:  Array<ExampleData>;
}

export interface ResponseData {
  headers?: Record<string, string>;
  body?: string | object;
  params?: Record<string, string>;
  cookies?: Record<string, string>;
  statusString?: string;
  status?: number;
}