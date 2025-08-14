import {Format, JSONRecord, Method, MMTFile, Protocol} from '../CommonData'

export interface InterfaceData {
  name: string;
  protocol: Protocol;
  format: Format;
  url: string;
  method?: Method;
  headers?: Record<string, string>;
  body?: string|object;
  query?: Record<string, string>;
  cookies?: Record<string, string>;
  outputs?: JSONRecord;
}

export interface ExampleData {
  name?: string;
  description?: string;
  inputs?: Record<string, string>;
}

export interface APIData extends MMTFile {
  title?: string;
  tags?: string[];
  description?: string;
  import?: Record<string, string>;
  inputs?: Record<string, string>;
  outputs?: Record<string, string>;
  setenv?: JSONRecord;
  interfaces?: Array<InterfaceData>;
  examples?: Array<ExampleData>;
}

export interface ResponseData {
  headers?: Record<string, string>;
  body?: string|object;
  query?: Record<string, string>;
  cookies?: Record<string, string>;
  statusString?: string;
  status?: number;
}