import {MockConnectionConfig, MockConnectionMode, MockData, MockEndpoint, MockFallback, MockProtocol} from './MockData';
import {Format, Method} from './CommonData';
import parseYaml, {packYaml} from './markupConvertor';
import {isNonEmptyList, isNonEmptyObject} from './safer';
import {resolveEmbeddedTokens} from './variableReplacer';

const VALID_PROTOCOLS: MockProtocol[] = ['http', 'https', 'ws'];
const VALID_CONNECTION_MODES: MockConnectionMode[] = ['plain', 'tls', 'mtls'];
const VALID_METHODS: Method[] = ['get', 'post', 'put', 'delete', 'patch', 'head', 'options', 'trace'];
const VALID_FORMATS: Format[] = ['json', 'xml', 'xmle', 'text', 'urlencoded'];

const MOCK_TOP_KEYS = new Set([
  'type', 'title', 'description', 'tags', 'import', 'protocol', 'port',
  'connection', 'cors', 'delay', 'headers', 'endpoints', 'proxy', 'fallback'
]);

const ENDPOINT_KEYS = new Set([
  'method', 'path', 'name', 'match', 'status', 'format',
  'headers', 'body', 'delay', 'reflect',
  // WS-specific
  'messages'
]);

export interface ParseError {
  message: string;
  severity: 'error' | 'warning';
}

export function parseMockData(yaml: any): {data: MockData | null; errors: ParseError[]} {
  const errors: ParseError[] = [];

  if (!yaml || typeof yaml !== 'object') {
    errors.push({message: 'Mock file must be a YAML object', severity: 'error'});
    return {data: null, errors};
  }

  if (yaml.type !== 'server') {
    errors.push({message: 'type must be "server"', severity: 'error'});
    return {data: null, errors};
  }

  // Check for unknown top-level keys
  for (const key of Object.keys(yaml)) {
    if (!MOCK_TOP_KEYS.has(key)) {
      errors.push({message: `Unknown field: ${key}`, severity: 'warning'});
    }
  }

  // Port (required): integer 1–65535, or env token e:VAR / <<e:VAR>>
  const normalizedPort = normalizeMockPort(yaml.port, errors);

  // Protocol: http|https|ws, or env token e:VAR / <<e:VAR>>
  const protocol = normalizeMockProtocolField(yaml.protocol, errors);

  const connection = parseConnectionConfig(yaml, protocol, errors);

  // Endpoints (required)
  if (!Array.isArray(yaml.endpoints)) {
    errors.push({message: 'endpoints must be an array', severity: 'error'});
  } else {
    const names = new Set<string>();
    yaml.endpoints.forEach((ep: any, i: number) => {
      if (ep == null) {
        return;
      }
      if (typeof ep !== 'object') {
        errors.push({message: `endpoints[${i}]: must be an object`, severity: 'error'});
        return;
      }
      for (const key of Object.keys(ep)) {
        if (!ENDPOINT_KEYS.has(key)) {
          errors.push({message: `endpoints[${i}]: unknown field "${key}"`, severity: 'warning'});
        }
      }
      if (!ep.path || typeof ep.path !== 'string') {
        errors.push({message: `endpoints[${i}]: path is required`, severity: 'error'});
      }
      if (protocol !== 'ws' && !ep.reflect) {
        if (!ep.method) {
          errors.push({message: `endpoints[${i}]: method is required for HTTP endpoints`, severity: 'error'});
        } else if (typeof ep.method === 'object') {
          errors.push({
            message: `endpoints[${i}]: method must be a string (use e:METHOD or quote incomplete tokens while typing)`,
            severity: 'error',
          });
        } else if (!VALID_METHODS.includes(ep.method) && !isMockEnvToken(String(ep.method))) {
          errors.push({message: `endpoints[${i}]: invalid method "${ep.method}"`, severity: 'error'});
        }
      }
      if (ep.status !== undefined) {
        const s = Number(ep.status);
        if (!Number.isInteger(s) || s < 100 || s > 599) {
          errors.push({message: `endpoints[${i}]: status must be 100-599`, severity: 'error'});
        }
      }
      if (ep.format && !VALID_FORMATS.includes(ep.format)) {
        errors.push({message: `endpoints[${i}]: format must be one of: ${VALID_FORMATS.join(', ')}`, severity: 'error'});
      }
      if (ep.delay !== undefined && (typeof ep.delay !== 'number' || ep.delay < 0)) {
        errors.push({message: `endpoints[${i}]: delay must be a non-negative number`, severity: 'error'});
      }
      if (ep.name) {
        if (names.has(ep.name)) {
          errors.push({message: `endpoints[${i}]: duplicate name "${ep.name}"`, severity: 'warning'});
        }
        names.add(ep.name);
      }
    });
  }

  // Delay
  if (yaml.delay !== undefined && (typeof yaml.delay !== 'number' || yaml.delay < 0)) {
    errors.push({message: 'delay must be a non-negative number', severity: 'error'});
  }

  // Fallback
  let fallback: MockFallback | undefined;
  if (yaml.fallback) {
    if (typeof yaml.fallback !== 'object') {
      errors.push({message: 'fallback must be an object', severity: 'error'});
    } else {
      fallback = {
        status: yaml.fallback.status ?? 404,
        format: yaml.fallback.format,
        headers: yaml.fallback.headers,
        body: yaml.fallback.body
      };
    }
  }

  const hasErrors = errors.some(e => e.severity === 'error');
  if (hasErrors) {
    return {data: null, errors};
  }

  const data: MockData = {
    type: 'server',
    title: yaml.title ? String(yaml.title) : undefined,
    description: yaml.description ? String(yaml.description) : undefined,
    tags: Array.isArray(yaml.tags) ? yaml.tags.filter((t: any) => t != null).map(String) : undefined,
    import: yaml.import && typeof yaml.import === 'object' && !Array.isArray(yaml.import) ? {...yaml.import} : undefined,
    protocol,
    port: normalizedPort ?? 0,
    connection,
    cors: !!yaml.cors,
    delay: typeof yaml.delay === 'number' ? yaml.delay : 0,
    headers: yaml.headers && typeof yaml.headers === 'object' ? yaml.headers : undefined,
    endpoints: (yaml.endpoints || []).filter((ep: any) => ep != null && typeof ep === 'object').map((ep: any) => parseEndpoint(ep)),
    proxy: yaml.proxy ? String(yaml.proxy) : undefined,
    fallback
  };

  return {data, errors};
}

function parseEndpoint(ep: any): MockEndpoint {
  const endpoint: MockEndpoint & {messages?: any[]} = {
    method: typeof ep.method === 'string' ? ep.method : undefined,
    path: typeof ep.path === 'string' ? String(ep.path) : '/',
    name: ep.name ? String(ep.name) : undefined,
    match: ep.match ? {
      body: ep.match.body,
      headers: ep.match.headers,
      query: ep.match.query
    } : undefined,
    status: ep.status ?? 200,
    format: ep.format || undefined,
    headers: ep.headers,
    body: ep.body,
    delay: ep.delay,
    reflect: !!ep.reflect
  };
  if (Array.isArray(ep.messages)) {
    endpoint.messages = ep.messages;
  }
  return endpoint;
}

export function yamlToMock(yamlContent: string): MockData | null {
  const yaml = parseYaml(yamlContent);
  if (!yaml || typeof yaml !== 'object') { return null; }
  if (yaml.type !== 'server') { return null; }
  // Lenient parse: build MockData even if some fields are missing/invalid,
  // so the format button can reorder fields in partially-written files.
  const data: MockData = {
    type: 'server',
    title: yaml.title ? String(yaml.title) : undefined,
    description: yaml.description ? String(yaml.description) : undefined,
    tags: Array.isArray(yaml.tags) ? yaml.tags.filter((t: any) => t != null).map(String) : undefined,
    import: yaml.import && typeof yaml.import === 'object' && !Array.isArray(yaml.import) ? {...yaml.import} : undefined,
    protocol: normalizeMockProtocolField(yaml.protocol),
    port: normalizeMockPortLenient(yaml.port),
    connection: parseConnectionConfig(yaml, normalizeMockProtocolField(yaml.protocol), []),
    cors: !!yaml.cors,
    delay: typeof yaml.delay === 'number' ? yaml.delay : 0,
    headers: yaml.headers && typeof yaml.headers === 'object' ? yaml.headers : undefined,
    endpoints: Array.isArray(yaml.endpoints) ? yaml.endpoints.filter((ep: any) => ep != null && typeof ep === 'object').map((ep: any) => parseEndpoint(ep)) : [],
    proxy: yaml.proxy ? String(yaml.proxy) : undefined,
    fallback: yaml.fallback && typeof yaml.fallback === 'object' ? {
      status: yaml.fallback.status ?? 404,
      format: yaml.fallback.format,
      headers: yaml.fallback.headers,
      body: yaml.fallback.body,
    } : undefined,
  };
  return data;
}

function normalizeMockProtocolField(raw: any, errors?: ParseError[]): MockProtocol | string {
  if (raw === undefined || raw === null || raw === '') {
    return 'http';
  }
  // Incomplete tokens like `protocol: e:` parse as nested maps and can swallow
  // following keys; treat as invalid rather than String(object) => "[object Object]".
  if (typeof raw === 'object') {
    if (errors) {
      errors.push({
        message: 'protocol must be http, https, ws, or an env token like e:MOCK_PROTOCOL',
        severity: 'error',
      });
    }
    return 'http';
  }
  const s = String(raw).trim();
  if (VALID_PROTOCOLS.includes(s as MockProtocol)) {
    return s as MockProtocol;
  }
  if (isMockEnvToken(s)) {
    return s;
  }
  if (errors) {
    errors.push({
      message: `protocol must be one of: ${VALID_PROTOCOLS.join(', ')}, or an env token like e:MOCK_PROTOCOL`,
      severity: 'error',
    });
  }
  return s;
}

function normalizeConnectionMode(rawMode: string | undefined, protocol: MockProtocol | string): MockConnectionMode {
  if (rawMode && VALID_CONNECTION_MODES.includes(rawMode as MockConnectionMode)) {
    return rawMode as MockConnectionMode;
  }
  if (protocol === 'https') {
    return 'tls';
  }
  return 'plain';
}

function parseConnectionConfig(
    yaml: any,
    protocol: MockProtocol | string,
    errors: ParseError[]): MockConnectionConfig | undefined {
  const rawConnection = yaml.connection && typeof yaml.connection === 'object' ? yaml.connection : undefined;
  if (yaml.connection && typeof yaml.connection !== 'object') {
    errors.push({message: 'connection must be an object', severity: 'error'});
  }
  const rawMode = rawConnection?.mode ? String(rawConnection.mode) : undefined;
  if (rawMode && !VALID_CONNECTION_MODES.includes(rawMode as MockConnectionMode)) {
    errors.push({message: `connection.mode must be one of: ${VALID_CONNECTION_MODES.join(', ')}`, severity: 'error'});
  }
  const mode = normalizeConnectionMode(rawMode, protocol);
  const connection: MockConnectionConfig = {
    mode,
    cert: rawConnection?.cert ? String(rawConnection.cert) : undefined,
    key: rawConnection?.key ? String(rawConnection.key) : undefined,
    client_ca: rawConnection?.client_ca ? String(rawConnection.client_ca) : undefined,
  };
  const isConcreteProtocol = VALID_PROTOCOLS.includes(protocol as MockProtocol);
  if (mode !== 'plain' && isConcreteProtocol && protocol !== 'https') {
    errors.push({message: 'protocol must be https when connection.mode is tls or mtls', severity: 'error'});
  }
  if (mode === 'mtls' && !connection.client_ca) {
    errors.push({message: 'connection.client_ca is required when connection.mode is mtls', severity: 'error'});
  }
  if (mode === 'plain' && !connection.cert && !connection.key && !connection.client_ca && !rawConnection) {
    return undefined;
  }
  return connection;
}

export function mockToYaml(mock: MockData): string {
  const obj: Record<string, any> = {
    type: mock.type,
  };
  if (mock.title) { obj.title = mock.title; }
  if (mock.description) { obj.description = mock.description; }
  if (isNonEmptyList(mock.tags)) { obj.tags = mock.tags; }
  if (isNonEmptyObject(mock.import)) { obj.import = mock.import; }
  if (mock.protocol && mock.protocol !== 'http') { obj.protocol = mock.protocol; }
  obj.port = mock.port;
  if (mock.connection && (mock.connection.mode !== 'plain' || mock.connection.cert || mock.connection.key || mock.connection.client_ca)) {
    obj.connection = mock.connection;
  }
  if (mock.cors) { obj.cors = mock.cors; }
  if (mock.delay) { obj.delay = mock.delay; }
  if (isNonEmptyObject(mock.headers)) { obj.headers = mock.headers; }
  if (mock.proxy) { obj.proxy = mock.proxy; }
  obj.endpoints = mock.endpoints.map(ep => {
    const e: Record<string, any> = {};
    if ('method' in ep && ep.method) { e.method = ep.method; }
    e.path = ep.path;
    if ('name' in ep && ep.name) { e.name = ep.name; }
    if ('match' in ep && ep.match) { e.match = ep.match; }
    if ('status' in ep) { e.status = ep.status; }
    if (ep.format) { e.format = ep.format; }
    if ('headers' in ep && isNonEmptyObject(ep.headers)) { e.headers = ep.headers; }
    if (ep.body !== undefined && ep.body !== null && ep.body !== '') { e.body = ep.body; }
    if ('delay' in ep && ep.delay) { e.delay = ep.delay; }
    if ('reflect' in ep && ep.reflect) { e.reflect = ep.reflect; }
    if ('messages' in ep && Array.isArray(ep.messages)) { e.messages = ep.messages; }
    return e;
  });
  if (mock.fallback) {
    const fb: Record<string, any> = {};
    if (mock.fallback.status !== undefined) { fb.status = mock.fallback.status; }
    if (mock.fallback.format) { fb.format = mock.fallback.format; }
    if (isNonEmptyObject(mock.fallback.headers)) { fb.headers = mock.fallback.headers; }
    if (mock.fallback.body !== undefined && mock.fallback.body !== null && mock.fallback.body !== '') { fb.body = mock.fallback.body; }
    obj.fallback = fb;
  }
  return packYaml(obj);
}

const ENV_TOKEN_RE =
    /^(?:e:[A-Za-z_][A-Za-z0-9_\-]*|<<\s*e:[A-Za-z_][A-Za-z0-9_\-]*\s*>>)$/;

/** True when value is an env token like `e:MOCK_PORT` or `<<e:MOCK_PORT>>`. */
export function isMockEnvToken(value: string): boolean {
  return ENV_TOKEN_RE.test(String(value || '').trim());
}

/** @deprecated Use isMockEnvToken */
export function isMockPortEnvToken(value: string): boolean {
  return isMockEnvToken(value);
}

function isValidListenPort(n: number): boolean {
  return Number.isInteger(n) && n >= 1 && n <= 65535;
}

/**
 * Normalize/validate a mock `port` field.
 * Accepts integers 1–65535, numeric strings, or env tokens (`e:VAR` / `<<e:VAR>>`).
 */
export function normalizeMockPort(
    raw: any, errors: ParseError[]): number | string | undefined {
  if (raw === undefined || raw === null || raw === '') {
    errors.push({message: 'port is required', severity: 'error'});
    return undefined;
  }
  if (typeof raw === 'number') {
    if (!isValidListenPort(raw)) {
      errors.push({message: 'port must be an integer between 1 and 65535', severity: 'error'});
    }
    return raw;
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (isMockEnvToken(trimmed)) {
      return trimmed;
    }
    if (/^\d+$/.test(trimmed)) {
      const asNum = Number(trimmed);
      if (!isValidListenPort(asNum)) {
        errors.push({message: 'port must be an integer between 1 and 65535', severity: 'error'});
      }
      return asNum;
    }
    errors.push({
      message: 'port must be an integer between 1 and 65535, or an env token like e:MOCK_PORT',
      severity: 'error',
    });
    return trimmed;
  }
  // Incomplete `port: e:` parses as a nested map — reject without crashing callers.
  errors.push({
    message: 'port must be an integer between 1 and 65535, or an env token like e:MOCK_PORT',
    severity: 'error',
  });
  return undefined;
}

/** Lenient port normalize for format/canonicalize (keeps invalid string values). */
function normalizeMockPortLenient(raw: any): number | string {
  if (typeof raw === 'number') {
    return raw;
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) {
      return 0;
    }
    if (isMockEnvToken(trimmed)) {
      return trimmed;
    }
    if (/^\d+$/.test(trimmed)) {
      return Number(trimmed);
    }
    return trimmed;
  }
  return 0;
}

/**
 * Resolve a mock listen port against env vars.
 * `port: e:MOCK_PORT` / `<<e:MOCK_PORT>>` become numbers from the environment.
 */
export function resolveMockPort(
    port: number | string, envVars: Record<string, any> = {}): number {
  if (typeof port === 'number') {
    if (!isValidListenPort(port)) {
      throw new Error(`Mock server: invalid port ${port}`);
    }
    return port;
  }

  const resolved = resolveEmbeddedTokens(String(port).trim(), envVars);
  const n = typeof resolved === 'number' ? resolved : Number(String(resolved ?? '').trim());
  if (!isValidListenPort(n)) {
    throw new Error(
        `Mock server: port "${port}" resolved to "${resolved}", which is not a valid port (1–65535)`);
  }
  return n;
}

/**
 * Resolve a mock protocol against env vars.
 * `protocol: e:MOCK_PROTOCOL` becomes http|https|ws from the environment.
 */
export function resolveMockProtocol(
    protocol: MockProtocol | string | undefined,
    envVars: Record<string, any> = {}): MockProtocol {
  const raw = protocol === undefined || protocol === null || protocol === '' ? 'http' : protocol;
  if (typeof raw !== 'string') {
    throw new Error('Mock server: invalid protocol value');
  }
  const trimmed = raw.trim();
  if (VALID_PROTOCOLS.includes(trimmed as MockProtocol)) {
    return trimmed as MockProtocol;
  }
  const resolved = resolveEmbeddedTokens(trimmed, envVars);
  const s = String(resolved ?? '').trim().toLowerCase();
  if (!VALID_PROTOCOLS.includes(s as MockProtocol)) {
    throw new Error(
        `Mock server: protocol "${protocol}" resolved to "${resolved}", which is not one of: ${VALID_PROTOCOLS.join(', ')}`);
  }
  return s as MockProtocol;
}
