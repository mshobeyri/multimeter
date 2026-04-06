import {Format, JSONRecord, JSONValue, Method, MMTFile, Protocol} from './CommonData';

export interface AuthBearer {
  type: 'bearer';
  token: string;
}

export interface AuthBasic {
  type: 'basic';
  username: string;
  password: string;
}

export interface AuthApiKey {
  type: 'api-key';
  header?: string;
  query?: string;
  value: string;
}

export interface AuthOAuth2 {
  type: 'oauth2';
  grant: 'client_credentials';
  token_url: string;
  client_id: string;
  client_secret: string;
  scope?: string;
}

export type AuthConfig = AuthBearer | AuthBasic | AuthApiKey | AuthOAuth2 | 'none';

export interface ExampleData {
  name?: string;
  description?: string;
  inputs?: JSONRecord;
  // Optional expected outputs for this example (mirrors API level outputs)
  outputs?: JSONRecord;
}

export interface GraphQLConfig {
  operation: string;
  variables?: Record<string, JSONValue>;
  operationName?: string;
}

export interface APIData extends MMTFile {
  title?: string;
  description?: string;
  tags?: string[];
  inputs?: JSONRecord;
  outputs?: Record<string, string>;
  setenv?: JSONRecord;
  url: string;
  query?: Record<string, string>;
  protocol?: Protocol;
  format: Format;
  method?: Method;
  headers?: Record<string, string>;
  cookies?: Record<string, string>;
  body?: string|object|null;
  auth?: AuthConfig;
  graphql?: GraphQLConfig;
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