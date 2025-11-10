import axios from 'axios';
import * as https from 'https';
import WebSocket from 'ws';

export interface CaCertificate {
  enabled: boolean;
  certData?: Buffer;
}

export interface ClientCertificate {
  id: string;
  name: string;
  host: string;
  certData?: Buffer;
  keyData?: Buffer;
  enabled: boolean;
}

export interface NetworkConfig {
  ca: CaCertificate;
  clients: ClientCertificate[];
  sslValidation: boolean;
  timeout: number;
  autoFormat: boolean;
}

export interface HttpRequest {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  query?: Record<string, string>;
  cookies?: Record<string, string>;
}

export interface HttpResponse {
  body: string;
  headers: Record<string, string>;
  status: number;
  statusText: string;
  duration: number;
  autoformat: boolean;
}

export interface Request {
  url?: string;
  protocol?: "http" | "ws" | undefined;
  format?: "json" | "xml" | "text" | undefined;
  method?: string;
  headers?: Record<string, string> | undefined;
  cookies?: Record<string, string> | undefined;
  query?: Record<string, string> | undefined;
  body?: any;
}

export interface Response {
  format?: "json" | "xml" | "text" | undefined;
  headers?: Record<string, string> | undefined;
  cookies?: Record<string, string> | undefined;
  query?: Record<string, string> | undefined;
  body?: any;
  status?: number | -1;
  duration?: number | -1;
  errorMessage: string | "";
  errorCode: string | "";
}


export function createHttpsAgentWithCertificates(
    hostname: string, config: NetworkConfig) {
  const agentOptions:
      https.AgentOptions = {rejectUnauthorized: config.sslValidation};
  if (config.ca.enabled && config.ca.certData) {
    agentOptions.ca = [config.ca.certData];
  }
  const matchingClientCert = config.clients.find(
      cert => cert.enabled &&
          (cert.host === hostname || hostname.includes(cert.host) ||
           cert.host === '*'));
  if (matchingClientCert && matchingClientCert.certData &&
      matchingClientCert.keyData) {
    agentOptions.cert = matchingClientCert.certData;
    agentOptions.key = matchingClientCert.keyData;
  }
  return new https.Agent(agentOptions);
}

export async function sendHttpRequest(
    req: HttpRequest, config: NetworkConfig): Promise<HttpResponse> {
  const parsedUrl = new URL(req.url);
  const hostname = parsedUrl.hostname;
  let reqHeaders = {...req.headers};
  if (req.cookies && Object.keys(req.cookies).length > 0) {
    reqHeaders['Cookie'] =
        Object.entries(req.cookies).map(([k, v]) => `${k}=${v}`).join('; ');
  }
  const httpsAgent = parsedUrl.protocol === 'https:' ?
      createHttpsAgentWithCertificates(hostname, config) :
      undefined;
  const request = {
    url: req.url,
    method: req.method || 'get',
    data: req.body,
    params: req.query,
    withCredentials: true,
    headers: reqHeaders,
    httpsAgent,
    timeout: config.timeout,
    responseType: 'text' as const,
    transformResponse: [(data: string) => data],
  };
  const start = Date.now();
  const response = await axios.request(request);
  const duration = Date.now() - start;
  return {
    body: response.data,
    headers: Object.fromEntries(Object.entries(response.headers)
                                    .filter(([_, v]) => v !== undefined)
                                    .map(([k, v]) => [k, String(v)])),
    status: response.status,
    statusText: response.statusText,
    duration,
    autoformat: config.autoFormat,
  };
}

export async function sendWsRequest(req: Request, config: NetworkConfig): Promise<Response> {
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
      const message = req.body ? (typeof req.body === 'string' ? req.body : JSON.stringify(req.body)) : '';
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
          errorMessage: "",
          errorCode: "",
        });
      }
    });

    ws.on('error', (error: Error) => {
      if (!resolved) {
        resolved = true;
        duration = Date.now() - start;
        ws.close();
        reject({
          body: "",
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
          body: "",
          headers: {},
          status: 200,
          duration,
          errorMessage: "",
          errorCode: "",
        });
      }
    });

    // Timeout
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        ws.close();
        reject({
          body: "",
          headers: {},
          status: -1,
          duration: config.timeout,
          errorMessage: "WebSocket request timed out",
          errorCode: "TIMEOUT",
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
    hostname: string, config: NetworkConfig) {
  const wsOptions: any = {rejectUnauthorized: config.sslValidation};
  if (config.ca.enabled && config.ca.certData) {
    wsOptions.ca = [config.ca.certData];
  }
  const matchingClientCert = config.clients.find(
      cert => cert.enabled &&
          (cert.host === hostname || hostname.includes(cert.host) ||
           cert.host === '*'));
  if (matchingClientCert && matchingClientCert.certData &&
      matchingClientCert.keyData) {
    wsOptions.cert = matchingClientCert.certData;
    wsOptions.key = matchingClientCert.keyData;
  }
  return wsOptions;
}

// Define your default config (adjust values as needed)
const defaultConfig: NetworkConfig = {
  ca: {enabled: false},
  clients: [],
  sslValidation: true,
  timeout: 30000,
  autoFormat: false,
};

// Generic send function using default config
export async function send(req: Request): Promise<Response> {
  if (!req.url) {
    throw new Error('URL is required');
  }
  const protocol = req.protocol || 'http';
  if (protocol === 'ws') {
    return sendWsRequest(req, defaultConfig);
  } else if (protocol === 'http') {
    const httpReq: HttpRequest = {
      url: req.url,
      method: req.method,
      headers: req.headers,
      body: typeof req.body === 'string' ? req.body : JSON.stringify(req.body),
      query: req.query,
      cookies: req.cookies,
    };
    const httpRes = await sendHttpRequest(httpReq, defaultConfig);
    return {
      body: httpRes.body,
      headers: httpRes.headers,
      status: httpRes.status,
      duration: httpRes.duration,
      errorMessage: "",
      errorCode: "",
    };
  } else {
    throw new Error(`Unsupported protocol: ${protocol}`);
  }
}