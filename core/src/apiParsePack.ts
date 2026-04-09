
import {APIData, AuthConfig, GraphQLConfig, GrpcConfig} from './APIData';
import {GrpcStream} from './CommonData';
import parseYaml, {packYaml, parseYamlStrict} from './markupConvertor';
import {isNonEmptyList, isNonEmptyObject, safeList} from './safer';

/** Valid root-level keys for type: api files. */
const VALID_API_ROOT_KEYS = new Set([
  'type', 'title', 'description', 'tags', 'inputs', 'outputs', 'setenv',
  'url', 'query', 'protocol', 'format', 'method', 'headers', 'cookies',
  'body', 'auth', 'graphql', 'grpc', 'examples',
]);

const VALID_GRPC_STREAM_VALUES = new Set<string>(['server', 'client', 'bidi']);

function parseGraphQLConfig(raw: any): GraphQLConfig | undefined {
  if (!raw || typeof raw !== 'object') {
    return undefined;
  }
  const config: GraphQLConfig = {
    operation: typeof raw.operation === 'string' ? raw.operation : '',
  };
  if (raw.variables && typeof raw.variables === 'object') {
    config.variables = raw.variables;
  }
  if (typeof raw.operationName === 'string') {
    config.operationName = raw.operationName;
  }
  return config;
}

function parseGrpcConfig(raw: any): GrpcConfig | undefined {
  if (!raw || typeof raw !== 'object') {
    return undefined;
  }
  const config: GrpcConfig = {
    service: typeof raw.service === 'string' ? raw.service : '',
    method: typeof raw.method === 'string' ? raw.method : '',
  };
  if (typeof raw.proto === 'string') {
    config.proto = raw.proto;
  }
  if (raw.message && typeof raw.message === 'object') {
    config.message = raw.message;
  }
  if (typeof raw.stream === 'string' && VALID_GRPC_STREAM_VALUES.has(raw.stream)) {
    config.stream = raw.stream as GrpcStream;
  }
  return config;
}

const VALID_AUTH_TYPES = new Set(['bearer', 'basic', 'api-key', 'oauth2']);

export function validateAuth(raw: any): AuthConfig | undefined {
  if (raw === undefined || raw === null) {
    return undefined;
  }
  if (raw === 'none') {
    return 'none';
  }
  if (typeof raw !== 'object') {
    throw new Error(`Invalid auth: expected an object or "none", got ${typeof raw}`);
  }
  if (!raw.type || !VALID_AUTH_TYPES.has(raw.type)) {
    throw new Error(`Invalid auth type: "${raw.type || '(none)'}". Must be one of: ${[...VALID_AUTH_TYPES].join(', ')}`);
  }
  switch (raw.type) {
    case 'bearer':
      if (raw.token == null) {
        throw new Error('Invalid auth: bearer requires "token" field');
      }
      return {type: 'bearer', token: String(raw.token)};
    case 'basic':
      if (raw.username == null || raw.password == null) {
        throw new Error('Invalid auth: basic requires "username" and "password" fields');
      }
      return {type: 'basic', username: String(raw.username), password: String(raw.password)};
    case 'api-key':
      if (raw.value == null) {
        throw new Error('Invalid auth: api-key requires "value" field');
      }
      if (raw.header == null && raw.query == null) {
        throw new Error('Invalid auth: api-key requires either "header" or "query" field');
      }
      if (raw.header != null && raw.query != null) {
        throw new Error('Invalid auth: api-key must have exactly one of "header" or "query", not both');
      }
      return {
        type: 'api-key',
        ...(raw.header != null ? {header: String(raw.header)} : {query: String(raw.query)}),
        value: String(raw.value),
      };
    case 'oauth2':
      if (raw.grant != null && raw.grant !== 'client_credentials') {
        throw new Error('Invalid auth: oauth2 requires grant: "client_credentials"');
      }
      if (raw.token_url == null) {
        throw new Error('Invalid auth: oauth2 requires "token_url" field');
      }
      if (raw.client_id == null) {
        throw new Error('Invalid auth: oauth2 requires "client_id" field');
      }
      if (raw.client_secret == null) {
        throw new Error('Invalid auth: oauth2 requires "client_secret" field');
      }
      return {
        type: 'oauth2',
        grant: 'client_credentials',
        token_url: String(raw.token_url),
        client_id: String(raw.client_id),
        client_secret: String(raw.client_secret),
        ...(raw.scope ? {scope: String(raw.scope)} : {}),
      };
    default:
      return undefined;
  }
}

/**
 * Apply auth configuration to request headers (and optionally query params).
 * Handles bearer, basic, and api-key. OAuth2 is skipped (requires async
 * token fetch which the caller must handle separately).
 * Returns the updated headers and query objects.
 */
export function applyAuthToRequest(
    auth: AuthConfig | undefined,
    headers: Record<string, string>,
    query?: Record<string, string>,
): {headers: Record<string, string>; query?: Record<string, string>} {
  if (!auth || auth === 'none') {
    return {headers, query};
  }
  const h = {...headers};
  const q = query ? {...query} : undefined;
  const hasHeader = (name: string) =>
      Object.keys(h).some(k => k.toLowerCase() === name.toLowerCase());
  switch (auth.type) {
    case 'bearer':
      if (auth.token && !hasHeader('authorization')) {
        h['Authorization'] = `Bearer ${auth.token}`;
      }
      break;
    case 'basic':
      if ((auth.username || auth.password) && !hasHeader('authorization')) {
        h['Authorization'] = `Basic ${btoa(`${auth.username}:${auth.password}`)}`;
      }
      break;
    case 'api-key':
      if (auth.value) {
        if (auth.header && !hasHeader(auth.header)) {
          h[auth.header] = auth.value;
        } else if (auth.query && q && !(auth.query in q)) {
          q[auth.query] = auth.value;
        }
      }
      break;
    // oauth2 requires async token fetch – handled by the runner's JS generation
  }
  return {headers: h, query: q};
}

export function yamlToAPI(yamlContent: string): APIData {
  try {
    const doc = parseYaml(yamlContent) as any;
    if (!doc || typeof doc !== 'object') {
      return {} as APIData;
    }
    // Directly map YAML fields to APIField
    let auth: AuthConfig | undefined;
    try {
      auth = validateAuth(doc.auth);
    } catch {
      // lenient parse – ignore invalid auth
    }
    return {
      type: doc.type || '',
      title: doc.title || '',
      description: typeof doc.description === 'string' ? doc.description.trimEnd() : '',
      tags: doc.tags,
      inputs: doc.inputs,
      outputs: doc.outputs,
      setenv: doc.setenv,
      protocol: doc.protocol || undefined,
      format: doc.format || 'json',
      url: doc.url || '',
      method: doc.method || '',
      headers: doc.headers || {},
      body: doc.body || '',
      query: doc.query || {},
      cookies: doc.cookies || {},
      auth,
      graphql: parseGraphQLConfig(doc.graphql),
      grpc: parseGrpcConfig(doc.grpc),
      examples: safeList(doc.examples),
    };
  } catch {
    return {} as APIData;
  }
}

/**
 * Parse an API YAML strictly: throws on YAML parse errors and validates
 * the resulting structure. Used in execution paths.
 */
export function yamlToAPIStrict(yamlContent: string): APIData {
  const doc = parseYamlStrict(yamlContent) as any;
  if (!doc || typeof doc !== 'object') {
    throw new Error('Invalid API file: YAML content is empty or not an object');
  }
  if (doc.type !== 'api') {
    throw new Error(`Invalid API file: expected type "api" but got "${doc.type || '(none)'}"`);
  }
  if (!doc.url) {
    throw new Error('Invalid API file: missing required "url" field');
  }
  const unknownKeys = Object.keys(doc).filter(k => !VALID_API_ROOT_KEYS.has(k));
  if (unknownKeys.length > 0) {
    throw new Error(`Invalid API file: unknown key(s): ${unknownKeys.map(k => `"${k}"`).join(', ')}`);
  }
  // GraphQL protocol validation
  const graphql = parseGraphQLConfig(doc.graphql);
  if (doc.protocol === 'graphql') {
    if (!graphql || !graphql.operation) {
      throw new Error('Invalid API file: protocol "graphql" requires "graphql.operation" field');
    }
    if (doc.body) {
      throw new Error('Invalid API file: "body" is not valid for protocol "graphql"; use "graphql.operation" and "graphql.variables" instead');
    }
  }
  if (doc.graphql && doc.protocol && doc.protocol !== 'graphql') {
    throw new Error(`Invalid API file: "graphql" block is ignored for protocol "${doc.protocol}"`);
  }
  // gRPC protocol validation
  const grpc = parseGrpcConfig(doc.grpc);
  if (doc.protocol === 'grpc') {
    if (!grpc || !grpc.service) {
      throw new Error('Invalid API file: protocol "grpc" requires "grpc.service" field');
    }
    if (!grpc.method) {
      throw new Error('Invalid API file: protocol "grpc" requires "grpc.method" field');
    }
    if (doc.body) {
      throw new Error('Invalid API file: "body" is not valid for protocol "grpc"; use "grpc.message" instead');
    }
    if (doc.query && Object.keys(doc.query).length > 0) {
      throw new Error('Invalid API file: "query" is not valid for protocol "grpc"');
    }
    if (doc.cookies && Object.keys(doc.cookies).length > 0) {
      throw new Error('Invalid API file: "cookies" is not valid for protocol "grpc"');
    }
  }
  if (doc.grpc && doc.protocol && doc.protocol !== 'grpc') {
    throw new Error(`Invalid API file: "grpc" block is ignored for protocol "${doc.protocol}"`);
  }
  const auth = validateAuth(doc.auth);
  return {
    type: doc.type || '',
    title: doc.title || '',
    description: typeof doc.description === 'string' ? doc.description.trimEnd() : '',
    tags: doc.tags,
    inputs: doc.inputs,
    outputs: doc.outputs,
    setenv: doc.setenv,
    protocol: doc.protocol || undefined,
    format: doc.format || 'json',
    url: doc.url || '',
    method: doc.method || '',
    headers: doc.headers || {},
    body: doc.body || '',
    query: doc.query || {},
    cookies: doc.cookies || {},
    auth,
    graphql,
    grpc,
    examples: safeList(doc.examples),
  };
}

export function apiToYaml(api: APIData): string {
  // Directly map APIField fields to YAML
  const yamlObj: Record<string, any> = {
    type: api.type,
    title: api.title,
  };
  if (api.description) {
    yamlObj.description = api.description;
  };
  if (isNonEmptyList(api.tags)) {
    yamlObj.tags = api.tags;
  };
  if (isNonEmptyObject(api.inputs)) {
    yamlObj.inputs = api.inputs;
  };
  if (isNonEmptyObject(api.outputs)) {
    yamlObj.outputs = api.outputs;
  };
  if (isNonEmptyObject(api.setenv)) {
    yamlObj.setenv = api.setenv;
  };
  if (api.url) {
    yamlObj.url = api.url;
  };
  if (isNonEmptyObject(api.query)) {
    yamlObj.query = api.query;
  };
  if (api.protocol) {
    yamlObj.protocol = api.protocol;
  };
  if (api.method) {
    yamlObj.method = api.method;
  };
  if (api.format) {
    yamlObj.format = api.format;
  };
  if (api.auth) {
    yamlObj.auth = api.auth;
  };
  if (isNonEmptyObject(api.headers)) {
    yamlObj.headers = api.headers;
  };
  if (isNonEmptyObject(api.cookies)) {
    yamlObj.cookies = api.cookies;
  };
  if (api.body && api.body !== '') {
    yamlObj.body = api.body;
  };
  if (api.graphql) {
    const gqlObj: Record<string, any> = {};
    if (api.graphql.operation) {
      gqlObj.operation = api.graphql.operation;
    }
    if (api.graphql.variables && Object.keys(api.graphql.variables).length > 0) {
      gqlObj.variables = api.graphql.variables;
    }
    if (api.graphql.operationName) {
      gqlObj.operationName = api.graphql.operationName;
    }
    if (Object.keys(gqlObj).length > 0) {
      yamlObj.graphql = gqlObj;
    }
  };
  if (api.grpc) {
    const grpcObj: Record<string, any> = {};
    if (api.grpc.proto) {
      grpcObj.proto = api.grpc.proto;
    }
    if (api.grpc.service) {
      grpcObj.service = api.grpc.service;
    }
    if (api.grpc.method) {
      grpcObj.method = api.grpc.method;
    }
    if (api.grpc.stream) {
      grpcObj.stream = api.grpc.stream;
    }
    if (api.grpc.message && Object.keys(api.grpc.message).length > 0) {
      grpcObj.message = api.grpc.message;
    }
    if (Object.keys(grpcObj).length > 0) {
      yamlObj.grpc = grpcObj;
    }
  };
  if (isNonEmptyList(api.examples)) {
    yamlObj.examples = api.examples;
  };
  return packYaml(yamlObj);
}