import {Format, JSONRecord, Method, MMTFile, Protocol} from '../CommonData'

export interface ExampleData {
  name?: string;
  description?: string;
  inputs?: JSONRecord;
}

export interface APIData extends MMTFile {
  title?: string;
  tags?: string[];
  description?: string;
  import?: Record<string, string>;
  inputs?: JSONRecord;
  outputs?: Record<string, string>;
  extract?: Record<string, string>;
  setenv?: JSONRecord;
  protocol: Protocol;
  format: Format;
  url: string;
  method?: Method;
  headers?: Record<string, string>;
  body?: string|object;
  query?: Record<string, string>;
  cookies?: Record<string, string>;
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