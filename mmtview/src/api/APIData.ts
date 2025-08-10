import {MMTFile, Protocol, Method, Format, Parameter} from "../CommonData"

export interface InterfaceData {
  name: string;
  protocol: Protocol;
  format: Format;
  url: string;
  method?: Method;
  headers?: Parameter[];
  body?: string | object;
  query?: Record<string, string>;
  cookies?: Record<string, string>;
  outputs?: Parameter[];
}

export interface ExampleData {
  name?: string;
  description?: string;
  inputs?: Parameter[];
}

export interface APIData extends MMTFile {
  title?: string;
  tags?: string[];
  description?: string;
  import?: Parameter[];
  inputs?: Parameter[];
  outputs?: Parameter[];
  setenv?: Parameter[];
  interfaces?: Array<InterfaceData>;
  examples?:  Array<ExampleData>;
}

export interface ResponseData {
  headers?: Record<string, string>;
  body?: string | object;
  query?: Record<string, string>;
  cookies?: Record<string, string>;
  statusString?: string;
  status?: number;
}