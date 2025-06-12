export type Protocol = "http" | "ws" | "grpc";
export type Format = "json" | "xml" | "protobuf";

export interface InterfaceData {
  name: string;
  protocol: Protocol;
  format: Format;
  endpoint: string;
  headers?: Record<string, string>;
  body?: string | object;
  query?: Record<string, string>;
  params?: Record<string, string>;
  cookies?: Record<string, string>;
  outputs?: Record<string, string | { [format: string]: string }>;
}

export type Parameter = { [key: string]: string };

export interface APIData {
  type: string;
  title?: string;
  tags?: string[];
  description?: string;
  inputs?: Parameter[];
  outputs?: Parameter[];
  interfaces?: Array<InterfaceData>;
}
