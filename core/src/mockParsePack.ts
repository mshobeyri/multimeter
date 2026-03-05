import {MockData, MockEndpoint, MockFallback, MockProtocol, MockTlsConfig} from './MockData';
import {Format, Method} from './CommonData';
import parseYaml, {packYaml} from './markupConvertor';
import {isNonEmptyList, isNonEmptyObject} from './safer';

const VALID_PROTOCOLS: MockProtocol[] = ['http', 'https', 'ws'];
const VALID_METHODS: Method[] = ['get', 'post', 'put', 'delete', 'patch', 'head', 'options', 'trace'];
const VALID_FORMATS: Format[] = ['json', 'xml', 'text'];

const MOCK_TOP_KEYS = new Set([
  'type', 'title', 'description', 'tags', 'protocol', 'port',
  'tls', 'cors', 'delay', 'headers', 'endpoints', 'proxy', 'fallback'
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

  // Port (required)
  if (yaml.port === undefined || yaml.port === null) {
    errors.push({message: 'port is required', severity: 'error'});
  } else if (typeof yaml.port !== 'number' || yaml.port < 1 || yaml.port > 65535 || !Number.isInteger(yaml.port)) {
    errors.push({message: 'port must be an integer between 1 and 65535', severity: 'error'});
  }

  // Protocol
  const protocol: MockProtocol = yaml.protocol || 'http';
  if (!VALID_PROTOCOLS.includes(protocol)) {
    errors.push({message: `protocol must be one of: ${VALID_PROTOCOLS.join(', ')}`, severity: 'error'});
  }

  // TLS
  let tls: MockTlsConfig | undefined;
  if (yaml.tls) {
    if (typeof yaml.tls !== 'object') {
      errors.push({message: 'tls must be an object', severity: 'error'});
    } else {
      if (!yaml.tls.cert) {
        errors.push({message: 'tls.cert is required', severity: 'error'});
      }
      if (!yaml.tls.key) {
        errors.push({message: 'tls.key is required', severity: 'error'});
      }
      tls = {
        cert: String(yaml.tls.cert || ''),
        key: String(yaml.tls.key || ''),
        ca: yaml.tls.ca ? String(yaml.tls.ca) : undefined,
        requestCert: !!yaml.tls.requestCert
      };
    }
  }
  if (protocol === 'https' && !tls) {
    errors.push({message: 'tls section is required when protocol is https', severity: 'error'});
  }

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
        } else if (!VALID_METHODS.includes(ep.method)) {
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
    protocol,
    port: yaml.port,
    tls,
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
  return {
    method: ep.method || undefined,
    path: String(ep.path || '/'),
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
    protocol: yaml.protocol || 'http',
    port: typeof yaml.port === 'number' ? yaml.port : (yaml.port || 0),
    tls: yaml.tls && typeof yaml.tls === 'object' ? {
      cert: String(yaml.tls.cert || ''),
      key: String(yaml.tls.key || ''),
      ca: yaml.tls.ca ? String(yaml.tls.ca) : undefined,
      requestCert: !!yaml.tls.requestCert,
    } : undefined,
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

export function mockToYaml(mock: MockData): string {
  const obj: Record<string, any> = {
    type: mock.type,
  };
  if (mock.title) { obj.title = mock.title; }
  if (mock.description) { obj.description = mock.description; }
  if (isNonEmptyList(mock.tags)) { obj.tags = mock.tags; }
  if (mock.protocol && mock.protocol !== 'http') { obj.protocol = mock.protocol; }
  obj.port = mock.port;
  if (mock.tls) { obj.tls = mock.tls; }
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
