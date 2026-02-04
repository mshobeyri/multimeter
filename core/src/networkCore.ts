// Node-only implementation. This module must not be imported by web bundles.
// `pkg` struggles with Axios's package exports in some environments.
// Require the concrete CJS build that Axios provides.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const axios = require('axios/dist/node/axios.cjs');
import * as http from 'http';
import * as https from 'https';
import WebSocket from 'ws';

import {connectionTracker} from './connectionTracker';
import {HttpRequest, HttpResponse, NetworkConfig, Request, Response} from './NetworkData';

// Re-export connectionTracker for use by extension
export {connectionTracker} from './connectionTracker';
export type {ActiveConnection, ConnectionEvent, ConnectionEventListener} from './connectionTracker';

// Shared agent pools for connection reuse and tracking
const httpAgentPool: Map<string, http.Agent> = new Map();
const httpsAgentPool: Map<string, https.Agent> = new Map();

// Track socket -> connection ID mapping
const socketConnectionIds = new WeakMap<any, string>();
const trackedSockets = new WeakSet<any>();

function getAgentKey(hostname: string, config: NetworkConfig, skipValidation: boolean): string {
  // Create a key that uniquely identifies the agent configuration
  const clientCertHost = config.clients.find(
    cert => cert.enabled &&
      (cert.host === hostname || hostname.includes(cert.host) || cert.host === '*')
  )?.host || '';
  return `${hostname}:${config.sslValidation}:${skipValidation}:${config.ca.enabled}:${clientCertHost}`;
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
    hostname: string, config: NetworkConfig,
    opts?: {skipCertificateValidation?: boolean}): https.Agent {
  const skipValidation = opts?.skipCertificateValidation ?? false;
  const agentKey = getAgentKey(hostname, config, skipValidation);

  // Check for existing agent in pool
  const existingAgent = httpsAgentPool.get(agentKey);
  if (existingAgent) {
    return existingAgent;
  }

  const rejectUnauthorized = skipValidation ? false : config.sslValidation;
  const agentOptions: https.AgentOptions = {
    rejectUnauthorized,
    keepAlive: true,
    keepAliveMsecs: 30000,
  };
  // Handle CA certificates (can be array or single Buffer for backward compat)
  if (config.ca.enabled && config.ca.certData) {
    if (Array.isArray(config.ca.certData)) {
      agentOptions.ca = config.ca.certData;
    } else {
      agentOptions.ca = [config.ca.certData];
    }
  }
  const matchingClientCert = config.clients.find(
      cert => cert.enabled &&
          (cert.host === hostname || hostname.includes(cert.host) ||
           cert.host === '*'));
  if (matchingClientCert && matchingClientCert.certData &&
      matchingClientCert.keyData) {
    agentOptions.cert = matchingClientCert.certData;
    agentOptions.key = matchingClientCert.keyData;
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

  httpsAgentPool.set(agentKey, agent);
  return agent;
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
  const baseRequestConfig = {
    url: req.url,
    method: req.method || 'get',
    data: req.body,
    params: req.query,
    withCredentials: true,
    headers: reqHeaders,
    timeout: config.timeout,
    responseType: 'text' as const,
    transformResponse: [(data: string) => data],
  };
  const executeRequest = (skipValidation = false) => {
    const isHttps = parsedUrl.protocol === 'https:';
    const httpsAgent = isHttps ?
        createHttpsAgentWithCertificates(
            hostname, config,
            {skipCertificateValidation: skipValidation}) :
        undefined;
    const httpAgent = !isHttps ? createHttpAgentWithTracking(hostname) : undefined;
    return axios.request({...baseRequestConfig, httpsAgent, httpAgent});
  };
  const start = Date.now();
  const toSuccess = (response: any): HttpResponse => {
    const duration = Date.now() - start;
    return {
      body: response.data,
      headers: normalizeAxiosHeaders(response.headers),
      status: response.status,
      statusText: response.statusText,
      duration,
      autoformat: config.autoFormat,
    };
  };
  const toError = (err: any): HttpResponse => {
    const duration = Date.now() - start;
    if (err?.response) {
      return {
        body: err.response.data,
        headers: normalizeAxiosHeaders(err.response.headers),
        status: err.response.status,
        statusText: err.response.statusText,
        duration,
        autoformat: config.autoFormat,
      };
    }
    const code = err?.code ? String(err.code) : 'NETWORK_ERROR';
    return {
      body: '',
      headers: {},
      status: -1,
      statusText: `${code}`,
      duration,
      autoformat: config.autoFormat,
    } as any;
  };
  const canRetrySelfSigned = config.allowSelfSigned && config.sslValidation &&
      parsedUrl.protocol === 'https:';
  try {
    const response = await executeRequest(false);
    return toSuccess(response);
  } catch (err: any) {
    if (canRetrySelfSigned && isSelfSignedTlsError(err)) {
      try {
        const retryResponse = await executeRequest(true);
        return toSuccess(retryResponse);
      } catch (retryErr: any) {
        return toError(retryErr);
      }
    }
    return toError(err);
  }
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
      wsOptions = createWebSocketOptionsWithCertificates(hostname, config);
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
    wsOptions = createWebSocketOptionsWithCertificates(hostname, config);
  }
  const ws = new WebSocket(url, wsOptions);
  return {ws, wsId};
}

export function createWebSocketOptionsWithCertificates(
    hostname: string, config: NetworkConfig,
    opts?: {skipCertificateValidation?: boolean}) {
  const rejectUnauthorized = opts?.skipCertificateValidation ? false :
      (config.allowSelfSigned ? false : config.sslValidation);
  const wsOptions: any = {rejectUnauthorized};
  // Handle CA certificates (can be array or single Buffer for backward compat)
  if (config.ca.enabled && config.ca.certData) {
    if (Array.isArray(config.ca.certData)) {
      wsOptions.ca = config.ca.certData;
    } else {
      wsOptions.ca = [config.ca.certData];
    }
  }
  const matchingClientCert = config.clients.find(
      cert => cert.enabled &&
          (cert.host === hostname || hostname.includes(cert.host) ||
           cert.host === '*'));
  if (matchingClientCert && matchingClientCert.certData &&
      matchingClientCert.keyData) {
    wsOptions.cert = matchingClientCert.certData;
    wsOptions.key = matchingClientCert.keyData;
    if (matchingClientCert.passphrase_plain) {
      wsOptions.passphrase = matchingClientCert.passphrase_plain;
    }
  }
  return wsOptions;
}

// Define your default config (adjust values as needed)
const defaultConfig: NetworkConfig = {
  ca: {enabled: false},
  clients: [],
  sslValidation: true,
  allowSelfSigned: false,
  timeout: 30000,
  autoFormat: false,
};

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

let runnerNetworkConfig: NetworkConfig = cloneNetworkConfig(defaultConfig);

export function setRunnerNetworkConfig(config: NetworkConfig) {
  if (!config) {
    runnerNetworkConfig = cloneNetworkConfig(defaultConfig);
    return;
  }
  runnerNetworkConfig = cloneNetworkConfig(config);
}

export function getRunnerNetworkConfig(): NetworkConfig {
  return cloneNetworkConfig(runnerNetworkConfig);
}

// Generic send function using default config
export async function send(req: Request): Promise<Response> {
  if (!req.url) {
    throw new Error('URL is required');
  }
  const protocol = req.protocol || 'http';
  if (protocol === 'ws') {
    return sendWsRequest(req, runnerNetworkConfig);
  } else if (protocol === 'http') {
    const httpReq: HttpRequest = {
      url: req.url,
      method: req.method,
      headers: req.headers,
      body: typeof req.body === 'string' ? req.body : JSON.stringify(req.body),
      query: req.query,
      cookies: req.cookies,
    };
    const httpRes = await sendHttpRequest(httpReq, runnerNetworkConfig);
    return {
      body: httpRes.body,
      headers: httpRes.headers,
      status: httpRes.status,
      duration: httpRes.duration,
      errorMessage: '',
      errorCode: '',
    };
  } else {
    throw new Error(`Unsupported protocol: ${protocol}`);
  }
}