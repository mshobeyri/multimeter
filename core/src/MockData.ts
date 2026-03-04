import {Format, JSONValue, Method, MMTFile} from './CommonData';

export interface MockTlsConfig {
  cert: string;
  key: string;
  ca?: string;
  requestCert?: boolean;
}

export interface MockMatch {
  body?: Record<string, JSONValue>;
  headers?: Record<string, string>;
  query?: Record<string, string>;
}

export interface MockEndpoint {
  method?: Method;
  path: string;
  name?: string;
  match?: MockMatch;
  status?: number;
  format?: Format;
  headers?: Record<string, string>;
  body?: JSONValue;
  delay?: number;
  reflect?: boolean;
}

export interface MockWsMessage {
  match?: Record<string, JSONValue>;
  body?: JSONValue;
  format?: Format;
  delay?: number;
}

export interface MockWsEndpoint {
  path: string;
  reflect?: boolean;
  body?: JSONValue;
  format?: Format;
  messages?: MockWsMessage[];
}

export interface MockFallback {
  status?: number;
  format?: Format;
  headers?: Record<string, string>;
  body?: JSONValue;
}

export type MockProtocol = 'http' | 'https' | 'ws';

export interface MockData extends MMTFile {
  type: 'server';
  title?: string;
  description?: string;
  tags?: string[];
  protocol?: MockProtocol;
  port: number;
  tls?: MockTlsConfig;
  cors?: boolean;
  delay?: number;
  headers?: Record<string, string>;
  endpoints: Array<MockEndpoint | MockWsEndpoint>;
  proxy?: string;
  fallback?: MockFallback;
}
