// Node-only implementation. This module must not be imported by web bundles.
// `pkg` struggles with Axios's package exports in some environments.
// Require the concrete CJS build that Axios provides.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const axios = require('axios/dist/node/axios.cjs');
import * as crypto from 'crypto';
import * as http from 'http';
import * as http2 from 'http2';
import * as https from 'https';
import WebSocket from 'ws';

import {connectionTracker} from './connectionTracker';
import {
  DEFAULT_NETWORK_CONFIG,
  findMatchingClientCertificate,
  HttpRequest,
  HttpResponse,
  matchesCertificateHost,
  NetworkConfig,
  Request,
  Response,
} from './NetworkData';

// Re-export connectionTracker for use by extension
export {connectionTracker} from './connectionTracker';
export type {ActiveConnection, ConnectionEvent, ConnectionEventListener} from './connectionTracker';

// Shared agent pools for connection reuse and tracking
const httpAgentPool: Map<string, http.Agent> = new Map();
const httpsAgentPool: Map<string, https.Agent> = new Map();

// Track socket -> connection ID mapping
const socketConnectionIds = new WeakMap<any, string>();
const trackedSockets = new WeakSet<any>();

function getLegacyRenegotiationSecureOptions(): number|undefined {
  let secureOptions = 0;
  const constants = crypto.constants as any;
  if (typeof constants.SSL_OP_LEGACY_SERVER_CONNECT === 'number') {
    secureOptions |= constants.SSL_OP_LEGACY_SERVER_CONNECT;
  }
  if (typeof constants.SSL_OP_ALLOW_UNSAFE_LEGACY_RENEGOTIATION === 'number') {
    secureOptions |= constants.SSL_OP_ALLOW_UNSAFE_LEGACY_RENEGOTIATION;
  }
  return secureOptions || undefined;
}


function applyTlsCompatibilityOptions(
    target: any,
    opts?: {forceTls12?: boolean}): void {
  // Match broad client compatibility: keep TLS versions negotiated by Node,
  // but allow legacy renegotiation and avoid reusing fragile TLS sessions.
  target.maxCachedSessions = 0;
  if (opts?.forceTls12) {
    target.maxVersion = 'TLSv1.2';
  }
  const secureOptions = getLegacyRenegotiationSecureOptions();
  if (typeof secureOptions === 'number') {
    target.secureOptions = (target.secureOptions || 0) | secureOptions;
  }
}

function trackSocketForAgent(socket: any, host: string, protocol: 'http' | 'https'): void {
  if (trackedSockets.has(socket)) {
    return;
  }
  trackedSockets.add(socket);

  const connId = connectionTracker.generateId();
  socketConnectionIds.set(socket, connId);

  connectionTracker.open({
    id: connId,
    host,
    protocol,
  });

  // Register close handler so user can close this socket
  connectionTracker.setCloseHandler(connId, () => {
    try {
      socket.destroy();
    } catch {
      // Ignore errors when destroying socket
    }
  });

  socket.once('connect', () => {
    connectionTracker.connected(connId);
  });

  if (protocol === 'https') {
    socket.once('secureConnect', () => {
      connectionTracker.connected(connId);
    });
  }

  socket.once('close', (hadError: boolean) => {
    connectionTracker.close(connId, hadError ? 'server' : 'client');
  });

  socket.once('error', () => {
    connectionTracker.close(connId, 'server');
  });

  socket.once('timeout', () => {
    connectionTracker.close(connId, 'timeout');
  });

  socket.once('end', () => {
    connectionTracker.close(connId, 'server');
  });
}

export function createHttpsAgentWithCertificates(
    hostname: string,
    port: string | undefined,
    protocol: string | undefined,
    config: NetworkConfig,
    opts?: {
      skipCertificateValidation?: boolean;
      fallbackClientCertId?: string;
      forceTls12?: boolean;
    }): https.Agent {
  const skipValidation = opts?.skipCertificateValidation ?? false;
  const rejectUnauthorized = skipValidation ? false : config.sslValidation;
  const agentOptions: https.AgentOptions = {
    rejectUnauthorized,
    keepAlive: false,
    keepAliveMsecs: 30000,
  };
  applyTlsCompatibilityOptions(agentOptions, {forceTls12: opts?.forceTls12});
  // Handle CA certificates (can be array or single Buffer for backward compat)
  if (config.ca.enabled && config.ca.certData) {
    if (Array.isArray(config.ca.certData)) {
      agentOptions.ca = config.ca.certData;
    } else {
      agentOptions.ca = [config.ca.certData];
    }
  }
    const matchingClientCert = opts?.fallbackClientCertId ?
      findUsableClientCertificateById(config, opts.fallbackClientCertId) :
      findMatchingClientCertificate(config.clients, hostname, port, protocol);
  if (matchingClientCert) {
    if (matchingClientCert.pfxData) {
      agentOptions.pfx = matchingClientCert.pfxData;
    } else if (matchingClientCert.certData && matchingClientCert.keyData) {
      agentOptions.cert = matchingClientCert.certData;
      agentOptions.key = matchingClientCert.keyData;
    }
    if (matchingClientCert.passphrase_plain) {
      agentOptions.passphrase = matchingClientCert.passphrase_plain;
    }
  }

  const agent = new https.Agent(agentOptions);

  // Hook into agent to track socket creation
  // Note: createConnection exists on Agent but isn't in the type definitions
  const originalCreateConnection = (agent as any).createConnection.bind(agent);
  (agent as any).createConnection = function(options: any, callback: any) {
    const socket = originalCreateConnection(options, callback);
    const port = options.port || 443;
    const host = `${options.hostname || options.host || hostname}:${port}`;
    trackSocketForAgent(socket, host, 'https');
    return socket;
  };

  return agent;
}

function hasUsableClientCertificate(client: any): boolean {
  return !!client?.enabled &&
      (!!client.pfxData || (!!client.certData && !!client.keyData));
}

function getUsableClientCertificates(config: NetworkConfig): any[] {
  return (config.clients || []).filter(hasUsableClientCertificate);
}

function findUsableClientCertificateById(
    config: NetworkConfig, clientId: string): any|undefined {
  return getUsableClientCertificates(config).find(client => client.id === clientId);
}

function getSingleFallbackClientCertificate(config: NetworkConfig): any|undefined {
  const usableClients = getUsableClientCertificates(config);
  return usableClients.length === 1 ? usableClients[0] : undefined;
}

function getCertificateRequiredRetryClient(
    config: NetworkConfig,
    hostname: string,
    port: string | undefined,
    protocol: string | undefined): any|undefined {
  const matchingClient = findMatchingClientCertificate(
      config.clients, hostname, port, protocol);
  if (hasUsableClientCertificate(matchingClient)) {
    return matchingClient;
  }
  return getSingleFallbackClientCertificate(config);
}

function hasMatchingUsableClientCertificate(
    config: NetworkConfig,
    hostname: string,
    port: string | undefined,
    protocol: string | undefined): boolean {
  return hasUsableClientCertificate(findMatchingClientCertificate(
      config.clients, hostname, port, protocol));
}

export function createHttpAgentWithTracking(hostname: string): http.Agent {
  const agentKey = `http:${hostname}`;

  const existingAgent = httpAgentPool.get(agentKey);
  if (existingAgent) {
    return existingAgent;
  }

  const agent = new http.Agent({
    keepAlive: true,
    keepAliveMsecs: 30000,
  });

  // Note: createConnection exists on Agent but isn't in the type definitions
  const originalCreateConnection = (agent as any).createConnection.bind(agent);
  (agent as any).createConnection = function(options: any, callback: any) {
    const socket = originalCreateConnection(options, callback);
    const port = options.port || 80;
    const host = `${options.hostname || options.host || hostname}:${port}`;
    trackSocketForAgent(socket, host, 'http');
    return socket;
  };

  httpAgentPool.set(agentKey, agent);
  return agent;
}

function createHttp2ConnectOptions(
    hostname: string,
    port: string | undefined,
    protocol: string | undefined,
    config: NetworkConfig,
    skipCertificateValidation: boolean): http2.SecureClientSessionOptions {
  const options: http2.SecureClientSessionOptions = {};
  if (protocol === 'https:') {
    options.rejectUnauthorized = skipCertificateValidation ? false : config.sslValidation;
    applyTlsCompatibilityOptions(options, {
      forceTls12: hasMatchingUsableClientCertificate(
          config, hostname, port, protocol),
    });
    if (config.ca.enabled && config.ca.certData) {
      options.ca = Array.isArray(config.ca.certData) ?
        config.ca.certData :
        [config.ca.certData];
    }
    const matchingClientCert = findMatchingClientCertificate(
        config.clients, hostname, port, protocol);
    if (matchingClientCert) {
      if (matchingClientCert.pfxData) {
        options.pfx = matchingClientCert.pfxData;
      } else if (matchingClientCert.certData && matchingClientCert.keyData) {
        options.cert = matchingClientCert.certData;
        options.key = matchingClientCert.keyData;
      }
      if (matchingClientCert.passphrase_plain) {
        options.passphrase = matchingClientCert.passphrase_plain;
      }
    }
  }
  return options;
}

function normalizeHttp2RequestHeaders(headers: Record<string, string>):
    Record<string, string> {
  const blockedHeaders = new Set([
    'connection',
    'keep-alive',
    'proxy-connection',
    'transfer-encoding',
    'upgrade',
    'host',
    'http2-settings',
  ]);
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    const normalizedKey = key.toLowerCase();
    if (blockedHeaders.has(normalizedKey)) {
      continue;
    }
    normalized[normalizedKey] = String(value);
  }
  return normalized;
}

function normalizeHttp2ResponseHeaders(raw: http2.IncomingHttpHeaders):
    Record<string, string> {
  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (key.startsWith(':') || value === undefined) {
      continue;
    }
    headers[key] = Array.isArray(value) ? value.join(', ') : String(value);
  }
  return headers;
}

function buildRequestPath(parsedUrl: URL, query?: Record<string, string>): string {
  const urlForPath = new URL(parsedUrl.toString());
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      urlForPath.searchParams.set(key, value);
    }
  }
  return `${urlForPath.pathname}${urlForPath.search}`;
}

function sendHttp2Request(
    req: HttpRequest,
    config: NetworkConfig,
    reqHeaders: Record<string, string>,
    parsedUrl: URL,
    requestTimeout: number,
    skipCertificateValidation = false): Promise<HttpResponse> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const authority = `${parsedUrl.protocol}//${parsedUrl.host}`;
    const session = http2.connect(
        authority,
        createHttp2ConnectOptions(
            parsedUrl.hostname, parsedUrl.port, parsedUrl.protocol, config,
            skipCertificateValidation));
    let settled = false;
    const settle = (fn: () => void) => {
      if (settled) {
        return;
      }
      settled = true;
      try {
        session.close();
      } catch {
        session.destroy();
      }
      fn();
    };

    const timer = setTimeout(() => {
      settle(() => {
        reject(Object.assign(new Error('HTTP/2 request timed out'), {
          code: 'TIMEOUT',
        }));
      });
    }, requestTimeout);

    session.once('error', (err) => {
      clearTimeout(timer);
      settle(() => reject(err));
    });

    const headers = {
      ':method': (req.method || 'get').toUpperCase(),
      ':path': buildRequestPath(parsedUrl, req.query),
      ':scheme': parsedUrl.protocol.replace(':', ''),
      ':authority': parsedUrl.host,
      ...normalizeHttp2RequestHeaders(reqHeaders),
    };
    const stream = session.request(headers);
    const chunks: Buffer[] = [];
    let responseHeaders: http2.IncomingHttpHeaders = {};

    stream.once('response', (headers) => {
      responseHeaders = headers;
    });
    stream.on('data', (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    stream.once('end', () => {
      clearTimeout(timer);
      settle(() => {
        const status = Number(responseHeaders[':status'] || 0);
        resolve({
          body: Buffer.concat(chunks).toString('utf8'),
          headers: normalizeHttp2ResponseHeaders(responseHeaders),
          status,
          statusText: http.STATUS_CODES[status] || '',
          duration: Date.now() - start,
          autoformat: config.autoFormat,
        });
      });
    });
    stream.once('error', (err) => {
      clearTimeout(timer);
      settle(() => reject(err));
    });
    stream.setTimeout(requestTimeout, () => {
      stream.close(http2.constants.NGHTTP2_CANCEL);
      clearTimeout(timer);
      settle(() => {
        reject(Object.assign(new Error('HTTP/2 request timed out'), {
          code: 'TIMEOUT',
        }));
      });
    });

    const body = req.body || '';
    if (body) {
      stream.end(body);
    } else {
      stream.end();
    }
  });
}

function sendNativeHttpsRequest(
    req: HttpRequest,
    config: NetworkConfig,
    reqHeaders: Record<string, string>,
    parsedUrl: URL,
    requestTimeout: number,
    clientId: string,
    skipCertificateValidation = false): Promise<HttpResponse> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const client = findUsableClientCertificateById(config, clientId);
    if (!client) {
      reject(new Error(`Client certificate ${clientId} is not available`));
      return;
    }

    const headers = {...reqHeaders};
    delete headers['Accept-Encoding'];
    delete headers['accept-encoding'];

    const requestOptions: https.RequestOptions = {
      protocol: parsedUrl.protocol,
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || undefined,
      path: buildRequestPath(parsedUrl, req.query),
      method: req.method || 'get',
      headers,
      rejectUnauthorized: skipCertificateValidation ? false : config.sslValidation,
      timeout: requestTimeout,
    };
    applyTlsCompatibilityOptions(requestOptions, {forceTls12: true});

    if (config.ca.enabled && config.ca.certData) {
      requestOptions.ca = Array.isArray(config.ca.certData) ?
        config.ca.certData :
        [config.ca.certData];
    }
    if (client.pfxData) {
      requestOptions.pfx = client.pfxData;
    } else if (client.certData && client.keyData) {
      requestOptions.cert = client.certData;
      requestOptions.key = client.keyData;
    }
    if (client.passphrase_plain) {
      requestOptions.passphrase = client.passphrase_plain;
    }

    const nativeReq = https.request(requestOptions, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });
      res.on('end', () => {
        const headersOut: Record<string, string> = {};
        for (const [key, value] of Object.entries(res.headers)) {
          if (value !== undefined) {
            headersOut[key] = Array.isArray(value) ? value.join(', ') : String(value);
          }
        }
        resolve({
          body: Buffer.concat(chunks).toString('utf8'),
          headers: headersOut,
          status: res.statusCode || 0,
          statusText: res.statusMessage || '',
          duration: Date.now() - start,
          autoformat: config.autoFormat,
        });
      });
    });
    nativeReq.on('error', reject);
    nativeReq.setTimeout(requestTimeout, () => {
      nativeReq.destroy(Object.assign(new Error('HTTPS request timed out'), {
        code: 'TIMEOUT',
      }));
    });
    if (req.body) {
      nativeReq.write(req.body);
    }
    nativeReq.end();
  });
}

/**
 * Record activity on a connection by socket
 */
export function recordConnectionActivity(socket: any): void {
  const connId = socketConnectionIds.get(socket);
  if (connId) {
    connectionTracker.activity(connId, { incrementRequests: true });
  }
}

/**
 * Mark a connection as idle by socket
 */
export function markConnectionIdle(socket: any): void {
  const connId = socketConnectionIds.get(socket);
  if (connId) {
    connectionTracker.idle(connId);
  }
}

/**
 * Close all HTTP/HTTPS agents and their connections
 */
export function closeAllHttpConnections(): void {
  for (const agent of httpsAgentPool.values()) {
    agent.destroy();
  }
  for (const agent of httpAgentPool.values()) {
    agent.destroy();
  }
  httpsAgentPool.clear();
  httpAgentPool.clear();
}

export async function sendHttpRequest(
    req: HttpRequest, config: NetworkConfig): Promise<HttpResponse> {
  const parsedUrl = new URL(req.url);
  const hostname = parsedUrl.hostname;
  let reqHeaders = {...req.headers};
  // Remove any headers where user explicitly set value to '_' (opt-out) or left
  // empty/null, and remember opt-out blocks by lower-cased name.
  const blocked = new Set<string>();
  for (const [k, v] of Object.entries({...reqHeaders})) {
    if (v === '_') {
      delete (reqHeaders as any)[k];
      blocked.add(k.toLowerCase());
      continue;
    }
    if (v === null || v === undefined ||
        (typeof v === 'string' && v.trim() === '')) {
      delete (reqHeaders as any)[k];
    }
  }
  const hasHeader = (name: string) =>
      Object.keys(reqHeaders).some(k => k.toLowerCase() === name.toLowerCase());
  const getHeader = (name: string) => {
    const key = Object.keys(reqHeaders)
                    .find(k => k.toLowerCase() === name.toLowerCase());
    return key ? reqHeaders[key] : undefined;
  };
  const setHeaderIfMissing = (name: string, value: string) => {
    if (blocked.has(name.toLowerCase())) {
      return;
    }
    if (hasHeader(name)) {
      return;
    }
    reqHeaders[name] = value;
  };
  if (req.cookies && Object.keys(req.cookies).length > 0) {
    reqHeaders['Cookie'] =
        Object.entries(req.cookies).map(([k, v]) => `${k}=${v}`).join('; ');
  }
  // Infer basic defaults for common HTTP headers unless blocked or already set
  setHeaderIfMissing('User-Agent', 'Multimeter');
  setHeaderIfMissing('Accept', '*/*');
  setHeaderIfMissing('Connection', 'keep-alive');
  setHeaderIfMissing('Accept-Encoding', 'gzip, deflate, br');

  // Content-Type and Content-Length: only when a body exists and not
  // blocked/overridden
  const bodyStr = req.body ?? '';
  const hasBody = typeof bodyStr === 'string' && bodyStr.length > 0;
  if (hasBody) {
    // Detect JSON body naïvely
    let detectedType = 'text/plain; charset=utf-8';
    try {
      const trimmed = bodyStr.trim();
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        JSON.parse(trimmed);
        detectedType = 'application/json; charset=utf-8';
      } else if (trimmed.startsWith('<')) {
        detectedType = 'application/xml; charset=utf-8';
      }
    } catch {
      // keep detectedType as text/plain
    }
    if (!blocked.has('content-type') && !hasHeader('Content-Type')) {
      reqHeaders['Content-Type'] = detectedType;
    }
    if (!blocked.has('content-length') && !hasHeader('Content-Length')) {
      const len = Buffer.byteLength(bodyStr, 'utf8');
      reqHeaders['Content-Length'] = String(len);
    }
  }
  const requestTimeout = typeof req.timeout === 'number' &&
      Number.isFinite(req.timeout) && req.timeout >= 0 ?
      req.timeout :
      config.timeout;
  const shouldUseHttp2 = config.httpVersion === '2';
  if (shouldUseHttp2) {
    const start = Date.now();
    const canRetrySelfSigned = config.sslValidation && parsedUrl.protocol === 'https:';
    try {
      return await sendHttp2Request(
          req, config, reqHeaders, parsedUrl, requestTimeout, false);
    } catch (err: any) {
      if (canRetrySelfSigned && isSelfSignedTlsError(err)) {
        const warning = formatSelfSignedWarning(err);
        try {
          return await sendHttp2Request(
              req, config, reqHeaders, parsedUrl, requestTimeout, true);
        } catch (retryErr: any) {
          return toNetworkError(retryErr, config, Date.now() - start, warning);
        }
      }
      return toNetworkError(err, config, Date.now() - start);
    }
  }
  const baseRequestConfig = {
    url: req.url,
    method: req.method || 'get',
    data: req.body,
    params: req.query,
    proxy: false,
    withCredentials: true,
    headers: reqHeaders,
    timeout: requestTimeout,
    responseType: 'text' as const,
    transformResponse: [(data: string) => data],
  };
  const executeRequest = (
      skipValidation = false,
      fallbackClientCertId?: string,
      opts?: {forceTls12?: boolean}) => {
    const isHttps = parsedUrl.protocol === 'https:';
    const forceTls12 = opts?.forceTls12 || (isHttps &&
        hasMatchingUsableClientCertificate(
            config, hostname, parsedUrl.port, parsedUrl.protocol));
    const httpsAgent = isHttps ?
        createHttpsAgentWithCertificates(
        hostname, parsedUrl.port, parsedUrl.protocol, config,
            {
              skipCertificateValidation: skipValidation,
              fallbackClientCertId,
              forceTls12,
            }) :
        undefined;
    const httpAgent = !isHttps ? createHttpAgentWithTracking(hostname) : undefined;
    return axios.request({...baseRequestConfig, httpsAgent, httpAgent});
  };
  const start = Date.now();
  const toSuccess = (response: any, warning?: string): HttpResponse => {
    const duration = Date.now() - start;
    return {
      body: response.data,
      headers: normalizeAxiosHeaders(response.headers),
      status: response.status,
      statusText: response.statusText,
      duration,
      autoformat: config.autoFormat,
      warning,
    };
  };
  const toError = (err: any, warning?: string): HttpResponse => {
    const duration = Date.now() - start;
    if (err?.response) {
      return {
        body: err.response.data,
        headers: normalizeAxiosHeaders(err.response.headers),
        status: err.response.status,
        statusText: err.response.statusText,
        duration,
        autoformat: config.autoFormat,
        warning: warning || formatResponseWarning(err),
      };
    }
    return {
      body: '',
      headers: {},
      status: -1,
      statusText: formatNetworkErrorStatusText(err),
      duration,
      autoformat: config.autoFormat,
      warning,
    } as any;
  };
  const canRetrySelfSigned = config.sslValidation && parsedUrl.protocol === 'https:';
  const matchingClientForNative = parsedUrl.protocol === 'https:' ?
    findMatchingClientCertificate(
        config.clients, hostname, parsedUrl.port, parsedUrl.protocol) :
    undefined;
  if (matchingClientForNative &&
      hasUsableClientCertificate(matchingClientForNative)) {
    try {
      const nativeClientId = matchingClientForNative.id;
      const nativeResponse = await sendNativeHttpsRequest(
          req, config, reqHeaders, parsedUrl, requestTimeout,
          nativeClientId);
      return {
        ...nativeResponse,
        warning: nativeResponse.status >= 400 ?
          `Server returned response: ${nativeResponse.status} ${nativeResponse.statusText}` :
          nativeResponse.warning,
      };
    } catch {
      // Fall through to the Axios path for non-mTLS transport errors.
    }
  }
  try {
    const response = await executeRequest(false);
    return toSuccess(response);
  } catch (err: any) {
    if (canRetrySelfSigned && isSelfSignedTlsError(err)) {
      const warning = formatSelfSignedWarning(err);
      try {
        const retryResponse = await executeRequest(true);
        return toSuccess(retryResponse, warning);
      } catch (retryErr: any) {
        return toError(retryErr, warning);
      }
    }
    if (parsedUrl.protocol === 'https:' && isClientCertificateRequiredTlsError(err)) {
      const retryClient = getCertificateRequiredRetryClient(
          config, hostname, parsedUrl.port, parsedUrl.protocol);
      if (retryClient) {
        try {
          const retryResponse = await executeRequest(
              false, retryClient.id, {forceTls12: true});
          return toSuccess(
              retryResponse,
              `Server requested a client certificate; retried with "${retryClient.name || retryClient.host || retryClient.id}" using legacy mTLS compatibility.`);
        } catch (retryErr: any) {
          return toError(retryErr);
        }
      }
    }
    if (parsedUrl.protocol === 'https:' && isClientCertificateRequiredHttpResponse(err)) {
      const retryClient = getCertificateRequiredRetryClient(
          config, hostname, parsedUrl.port, parsedUrl.protocol);
      if (retryClient) {
        try {
          const retryResponse = await sendNativeHttpsRequest(
              req, config, reqHeaders, parsedUrl, requestTimeout, retryClient.id);
          return {
            ...retryResponse,
            warning: `Server requested a client certificate; retried with "${retryClient.name || retryClient.host || retryClient.id}" using native mTLS transport.`,
          };
        } catch (retryErr: any) {
          return toError(retryErr);
        }
      }
    }
    return toError(err);
  }
}

function toNetworkError(
    err: any,
    config: NetworkConfig,
    duration: number,
    warning?: string): HttpResponse {
  return {
    body: '',
    headers: {},
    status: -1,
    statusText: formatNetworkErrorStatusText(err),
    duration,
    autoformat: config.autoFormat,
    warning,
  };
}

const SELF_SIGNED_TLS_CODES = new Set([
  'SELF_SIGNED_CERT_IN_CHAIN',
  'DEPTH_ZERO_SELF_SIGNED_CERT',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
]);

const SELF_SIGNED_MESSAGE_FRAGMENTS = [
  'self signed certificate',
  'unable to verify the first certificate',
];

const CLIENT_CERTIFICATE_REQUIRED_CODES = new Set([
  'ERR_SSL_TLSV13_ALERT_CERTIFICATE_REQUIRED',
  'ERR_SSL_TLSV1_ALERT_CERTIFICATE_REQUIRED',
  'ERR_SSL_SSLV3_ALERT_CERTIFICATE_REQUIRED',
]);

const CLIENT_CERTIFICATE_REQUIRED_MESSAGE_FRAGMENTS = [
  'alert certificate required',
  'certificate_required',
  'certificate required',
  'required ssl certificate',
  'ssl certificate was sent',
  'tlsv1_alert_certificate_required',
  'tlsv13_alert_certificate_required',
];

function normalizeAxiosHeaders(raw: Record<string, any> = {}):
    Record<string, string> {
  return Object.fromEntries(Object.entries(raw)
                                 .filter(([_, v]) => v !== undefined)
                                 .map(([k, v]) => [k, String(v)]));
}

function isSelfSignedTlsError(err: any): boolean {
  if (!err || err.response) {
    return false;
  }
  const code = extractErrorCode(err);
  if (code && SELF_SIGNED_TLS_CODES.has(code)) {
    return true;
  }
  const message = typeof err?.message === 'string' ? err.message.toLowerCase() : '';
  if (!message) {
    return false;
  }
  return SELF_SIGNED_MESSAGE_FRAGMENTS.some(fragment => message.includes(fragment));
}

function isClientCertificateRequiredTlsError(err: any): boolean {
  if (!err || err.response) {
    return false;
  }
  const code = extractErrorCode(err);
  if (code && CLIENT_CERTIFICATE_REQUIRED_CODES.has(code)) {
    return true;
  }
  const values = [
    err?.message,
    err?.reason,
    ...(Array.isArray(err?.opensslErrorStack) ? err.opensslErrorStack : []),
  ].filter(value => typeof value === 'string').map(value => value.toLowerCase());
  return values.some(value => CLIENT_CERTIFICATE_REQUIRED_MESSAGE_FRAGMENTS.some(
      fragment => value.includes(fragment)));
}

function isClientCertificateRequiredHttpResponse(err: any): boolean {
  const response = err?.response;
  if (!response) {
    return false;
  }
  const status = Number(response.status);
  if (status !== 400 && status !== 403) {
    return false;
  }
  const values = [
    response.statusText,
    response.data,
  ].filter(value => typeof value === 'string').map(value => value.toLowerCase());
  return values.some(value => CLIENT_CERTIFICATE_REQUIRED_MESSAGE_FRAGMENTS.some(
      fragment => value.includes(fragment)));
}

function formatSelfSignedWarning(err: any): string {
  const code = extractErrorCode(err);
  const message = typeof err?.message === 'string' ? err.message : 'self-signed certificate';
  return `Self-signed certificate warning: ${code ? `${code}: ` : ''}${message}`;
}

function formatResponseWarning(err: any): string|undefined {
  if (!err?.response) {
    return undefined;
  }
  const status = err.response.status;
  const statusText = err.response.statusText;
  const details = [status, statusText].filter(value => value !== undefined && value !== '').join(' ');
  return details ? `Server returned response: ${details}` : 'Server returned an error response';
}

function formatNetworkErrorStatusText(err: any): string {
  const parts: string[] = [];
  const code = extractErrorCode(err) || 'NETWORK_ERROR';
  parts.push(code);
  if (typeof err?.message === 'string' && err.message && err.message !== code) {
    parts.push(err.message);
  }
  if (typeof err?.reason === 'string' && err.reason &&
      !parts.includes(err.reason)) {
    parts.push(err.reason);
  }
  if (Array.isArray(err?.opensslErrorStack)) {
    for (const stackEntry of err.opensslErrorStack) {
      if (typeof stackEntry === 'string' && stackEntry &&
          !parts.includes(stackEntry)) {
        parts.push(stackEntry);
      }
    }
  }
  return parts.join(': ');
}

function extractErrorCode(err: any): string|undefined {
  if (err && typeof err.code === 'string' && err.code) {
    return err.code;
  }
  if (err?.cause && typeof err.cause.code === 'string' && err.cause.code) {
    return err.cause.code;
  }
  if (err?.originalError && typeof err.originalError.code === 'string' && err.originalError.code) {
    return err.originalError.code;
  }
  return undefined;
}

export async function sendWsRequest(
    req: Request, config: NetworkConfig): Promise<Response> {
  return new Promise((resolve, reject) => {
    const url = req.url!;
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname;
    let wsOptions = {};
    if (parsedUrl.protocol === 'wss:') {
      wsOptions = createWebSocketOptionsWithCertificates(
          hostname, parsedUrl.port, parsedUrl.protocol, config);
    }
    const ws = new WebSocket(url, wsOptions);
    const start = Date.now();
    let duration = 0;
    let resolved = false;

    ws.on('open', () => {
      const message = req.body ?
          (typeof req.body === 'string' ? req.body : JSON.stringify(req.body)) :
          '';
      ws.send(message);
    });

    ws.on('message', (data: WebSocket.RawData) => {
      if (!resolved) {
        resolved = true;
        duration = Date.now() - start;
        ws.close();
        resolve({
          body: data.toString(),
          headers: {},
          status: 200,
          duration,
          errorMessage: '',
          errorCode: '',
        });
      }
    });

    ws.on('error', (error: Error) => {
      if (!resolved) {
        resolved = true;
        duration = Date.now() - start;
        ws.close();
        reject({
          body: '',
          headers: {},
          status: -1,
          duration,
          errorMessage: error.message,
          errorCode: error.name,
        });
      }
    });

    ws.on('close', () => {
      if (!resolved) {
        resolved = true;
        duration = Date.now() - start;
        resolve({
          body: '',
          headers: {},
          status: 200,
          duration,
          errorMessage: '',
          errorCode: '',
        });
      }
    });

    // Timeout
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        ws.close();
        reject({
          body: '',
          headers: {},
          status: -1,
          duration: config.timeout,
          errorMessage: 'WebSocket request timed out',
          errorCode: 'TIMEOUT',
        });
      }
    }, config.timeout);
  });
}

// --- WebSocket Core ---

const openConnections: Record<string, WebSocket> = {};
export interface WsConnection {
  ws: WebSocket;
  wsId: string;
}

export function wsConnections(wsId: string) {
  return openConnections[wsId];
}

export function deleteWsConnection(wsId: string) {
  const ws = openConnections[wsId];
  if (ws) {
    ws.close();
    delete openConnections[wsId];
  }
  return ws;
}

export function addWsConnection(wsId: string, ws: WebSocket) {
  openConnections[wsId] = ws;
}

export function createWebSocket(
    url: string, wsId: string, config: NetworkConfig): WsConnection {
  const parsedUrl = new URL(url);
  const hostname = parsedUrl.hostname;
  let wsOptions = {};
  if (parsedUrl.protocol === 'wss:') {
    wsOptions = createWebSocketOptionsWithCertificates(
        hostname, parsedUrl.port, parsedUrl.protocol, config);
  }
  const ws = new WebSocket(url, wsOptions);
  return {ws, wsId};
}

export function createWebSocketOptionsWithCertificates(
    hostname: string,
    port: string | undefined,
    protocol: string | undefined,
    config: NetworkConfig,
    opts?: {skipCertificateValidation?: boolean}) {
  const rejectUnauthorized = opts?.skipCertificateValidation ? false :
      config.sslValidation;
  const wsOptions: any = {rejectUnauthorized};
  applyTlsCompatibilityOptions(wsOptions);
  // Handle CA certificates (can be array or single Buffer for backward compat)
  if (config.ca.enabled && config.ca.certData) {
    if (Array.isArray(config.ca.certData)) {
      wsOptions.ca = config.ca.certData;
    } else {
      wsOptions.ca = [config.ca.certData];
    }
  }
    const matchingClientCert = findMatchingClientCertificate(
      config.clients, hostname, port, protocol);
  if (matchingClientCert) {
    if (matchingClientCert.pfxData) {
      wsOptions.pfx = matchingClientCert.pfxData;
    } else if (matchingClientCert.certData && matchingClientCert.keyData) {
      wsOptions.cert = matchingClientCert.certData;
      wsOptions.key = matchingClientCert.keyData;
    }
    if (matchingClientCert.passphrase_plain) {
      wsOptions.passphrase = matchingClientCert.passphrase_plain;
    }
  }
  return wsOptions;
}

function cloneNetworkConfig(config: NetworkConfig): NetworkConfig {
  const ca = config?.ca ? {...config.ca} : {enabled: false};
  const clients = Array.isArray(config?.clients) ?
      config.clients.map(client => ({...client})) :
      [];
  return {
    ...config,
    ca,
    clients,
  };
}

let runnerNetworkConfig: NetworkConfig = cloneNetworkConfig(DEFAULT_NETWORK_CONFIG);

export function setRunnerNetworkConfig(config: NetworkConfig) {
  if (!config) {
    runnerNetworkConfig = cloneNetworkConfig(DEFAULT_NETWORK_CONFIG);
    return;
  }
  runnerNetworkConfig = cloneNetworkConfig(config);
}

export function getRunnerNetworkConfig(): NetworkConfig {
  return cloneNetworkConfig(runnerNetworkConfig);
}

const SENSITIVE_FIELD_RE = /(authorization|cookie|token|secret|password|passphrase|api[-_]?key|cert|keydata|pfx)/i;

function redactSensitiveRecord(record: Record<string, any>|undefined):
    Record<string, any>|undefined {
  if (!record || typeof record !== 'object') {
    return record;
  }
  return Object.fromEntries(Object.entries(record).map(([key, value]) => [
    key,
    SENSITIVE_FIELD_RE.test(key) ? '[redacted]' : value,
  ]));
}

function summarizeSendBody(body: any): any {
  if (body === undefined || body === null || body === '') {
    return body;
  }
  const value = typeof body === 'string' ? body : JSON.stringify(body);
  return {
    length: value.length,
    preview: value.length > 500 ? `${value.slice(0, 500)}...` : value,
  };
}

function summarizeSendRequest(req: Request): Record<string, any> {
  return {
    protocol: req.protocol,
    url: req.url,
    method: req.method,
    timeout: req.timeout,
    headers: redactSensitiveRecord(req.headers),
    cookies: redactSensitiveRecord(req.cookies),
    query: redactSensitiveRecord(req.query),
    body: summarizeSendBody(req.body),
  };
}

function summarizeSendConfig(config: NetworkConfig, req: Request): Record<string, any> {
  let hostname = '';
  let port = '';
  let protocol = '';
  try {
    const parsedUrl = new URL(req.url || '');
    hostname = parsedUrl.hostname;
    port = parsedUrl.port;
    protocol = parsedUrl.protocol;
  } catch {
    // Keep hostname empty when URL parsing fails; send will surface the real error.
  }
  return {
    sslValidation: config.sslValidation,
    allowSelfSigned: config.allowSelfSigned,
    httpVersion: config.httpVersion,
    timeout: config.timeout,
    ca: {
      enabled: config.ca?.enabled,
      hasData: !!config.ca?.certData,
    },
    clients: (config.clients || []).map(client => ({
      id: client.id,
      name: client.name,
      host: client.host,
      enabled: client.enabled,
      matchesRequest: hostname ? matchesCertificateHost(
          client.host, hostname, port, protocol) : false,
      hasCertKey: !!client.certData && !!client.keyData,
      hasPfx: !!client.pfxData,
      hasPassphrase: !!client.passphrase_plain,
    })),
  };
}

function summarizeSendResponse(response: Response|undefined): Record<string, any>|undefined {
  if (!response) {
    return response;
  }
  return {
    status: response.status,
    duration: response.duration,
    errorMessage: response.errorMessage,
    errorCode: response.errorCode,
    headers: redactSensitiveRecord(response.headers),
    body: summarizeSendBody(response.body),
    warning: response.warning,
  };
}

function logSendDebug(label: 'input'|'output'|'error', value: any): void {
  try {
    console.info(`[mmt send] ${label}: ${JSON.stringify(value)}`);
  } catch {
    console.info(`[mmt send] ${label}: [unserializable]`);
  }
}

// Generic send function using default config
export async function send(req: Request): Promise<Response> {
  if (!req.url) {
    throw new Error('URL is required');
  }
  logSendDebug('input', {
    request: summarizeSendRequest(req),
    networkConfig: summarizeSendConfig(runnerNetworkConfig, req),
  });
  const protocol = req.protocol || 'http';
  try {
    if (protocol === 'ws') {
      const response = await sendWsRequest(req, runnerNetworkConfig);
      logSendDebug('output', summarizeSendResponse(response));
      return response;
    } else if (protocol === 'http' || protocol === 'graphql') {
      const httpReq: HttpRequest = {
        url: req.url,
        method: req.method,
        timeout: req.timeout,
        headers: req.headers,
        body: typeof req.body === 'string' ? req.body : JSON.stringify(req.body),
        query: req.query,
        cookies: req.cookies,
      };
      const httpRes = await sendHttpRequest(httpReq, runnerNetworkConfig);
      const response = {
        body: httpRes.body,
        headers: httpRes.headers,
        status: httpRes.status,
        statusText: httpRes.statusText,
        duration: httpRes.duration,
        errorMessage: httpRes.status < 0 ? httpRes.statusText : '',
        errorCode: '',
        warning: httpRes.warning,
      };
      logSendDebug('output', summarizeSendResponse(response));
      return response;
    } else {
      throw new Error(`Unsupported protocol: ${protocol}`);
    }
  } catch (err: any) {
    logSendDebug('error', {
      message: err?.message || String(err),
      code: err?.code,
    });
    throw err;
  }
}