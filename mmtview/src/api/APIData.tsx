import {Type,Protocol, Method, Format, Parameter} from "../CommonData"

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