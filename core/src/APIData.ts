import {Format, FormatSpec, GrpcStream, JSONRecord, JSONValue, Method, MMTFile, Protocol} from './CommonData';
import type {ExpectMap} from './TestData';

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
  /** Stable example identifier (preferred). Used for selection and future `call: alias.id`. */
  id?: string;
  /** Display title (preferred). */
  title?: string;
  /**
   * @deprecated Use `id` and `title`. When `id` is missing, `name` is used as both
   * id and title. Click the struck-through `name:` in the editor to expand to id/title.
   */
  name?: string;
  description?: string;
  inputs?: JSONRecord;
  /**
   * @deprecated Use `expect`. Treated as a soft-expect map (equality checks).
   * Click the struck-through `outputs:` under an example to rename to `expect:`.
   */
  outputs?: JSONRecord;
  /** Soft checks on run outputs (same shape/operators as call expect). */
  expect?: ExpectMap;
}

/**
 * Effective soft-expect map: `expect`, with deprecated `outputs` filling missing keys.
 */
export function exampleExpect(example: ExampleData | null | undefined): ExpectMap | undefined {
  if (!example) {
    return undefined;
  }
  const fromExpect = example.expect && typeof example.expect === 'object' && !Array.isArray(example.expect) ?
      example.expect :
      undefined;
  const fromOutputs = example.outputs && typeof example.outputs === 'object' && !Array.isArray(example.outputs) ?
      example.outputs as ExpectMap :
      undefined;
  if (!fromExpect && !fromOutputs) {
    return undefined;
  }
  if (!fromOutputs) {
    return fromExpect;
  }
  if (!fromExpect) {
    return {...fromOutputs};
  }
  // Prefer explicit expect entries; fill gaps from deprecated outputs.
  const merged: ExpectMap = {...fromOutputs, ...fromExpect};
  return merged;
}

/** Effective example id: `id`, else deprecated `name`. */
export function exampleId(example: ExampleData | null | undefined): string | undefined {
  if (!example) {
    return undefined;
  }
  if (typeof example.id === 'string' && example.id.trim()) {
    return example.id.trim();
  }
  if (typeof example.name === 'string' && example.name.trim()) {
    return example.name.trim();
  }
  return undefined;
}

/** Effective example title: `title`, else deprecated `name`, else `id`. */
export function exampleTitle(example: ExampleData | null | undefined): string | undefined {
  if (!example) {
    return undefined;
  }
  if (typeof example.title === 'string' && example.title.trim()) {
    return example.title.trim();
  }
  if (typeof example.name === 'string' && example.name.trim()) {
    return example.name.trim();
  }
  if (typeof example.id === 'string' && example.id.trim()) {
    return example.id.trim();
  }
  return undefined;
}

/** Assertion maps for example expect (and shared eval helpers). */
export type ApiTestBlock = {
  expect?: ExpectMap;
  /** Hard checks — used by call/test steps; examples are expect-only. */
  require?: ExpectMap;
};

export interface GraphQLConfig {
  operation: string;
  variables?: Record<string, JSONValue>;
  operationName?: string;
}

export interface GrpcConfig {
  proto?: string;
  service: string;
  method: string;
  message?: object;
  stream?: GrpcStream;
}

export interface APIData extends MMTFile {
  title?: string;
  description?: string;
  tags?: string[];
  inputs?: JSONRecord;
  outputs?: Record<string, string>;
  /** Env var name → extraction expression (same DSL as outputs). Legacy: output key name. */
  setenv?: JSONRecord;
  url: string;
  query?: Record<string, string>;
  protocol?: Protocol;
  format?: FormatSpec;
  method?: Method;
  timeout?: number;
  headers?: Record<string, string>;
  cookies?: Record<string, string>;
  body?: string|object|null;
  auth?: AuthConfig;
  graphql?: GraphQLConfig;
  grpc?: GrpcConfig;
  examples?: Array<ExampleData>;
}
