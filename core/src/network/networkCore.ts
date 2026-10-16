// Node-only network facade. Prefer importing from here (or networkCoreNode)
// so the public surface stays stable while HTTP/WS/local transports live in
// focused modules.
//
// Layout:
//   httpAbort.ts            — AbortSignal / Axios cancel
//   httpTls.ts              — TLS options + client-cert helpers
//   httpAgents.ts           — keep-alive agents + Connections panel tracking
//   httpErrors.ts           — TLS/network error classification & formatting
//   httpSend.ts             — axios / HTTP2 / native HTTPS send
//   localMmtDevTransport.ts — in-process local.mmt.dev (HTTP + WS echo)
//   wsCore.ts               — WebSocket one-shot + live connection registry
//   localTestServer.ts      — shared local.mmt.dev / test.mmt.dev handlers

import {
  DEFAULT_NETWORK_CONFIG,
  HttpRequest,
  NetworkConfig,
  Request,
  Response,
} from '../data/NetworkData';
import {sendHttpRequest} from './httpSend';
import {sendWsRequest} from './wsCore';

// --- Connection tracker (Connections panel) ---
export {connectionTracker} from './connectionTracker';
export type {
  ActiveConnection,
  ConnectionEvent,
  ConnectionEventListener,
} from './connectionTracker';

// --- HTTP agents / sockets ---
export {
  closeAllHttpConnections,
  createHttpAgentWithTracking,
  createHttpsAgentWithCertificates,
  markConnectionIdle,
  recordConnectionActivity,
} from './httpAgents';

// --- HTTP send ---
export {sendHttpRequest} from './httpSend';

// --- WebSocket ---
export {
  addWsConnection,
  createWebSocket,
  createWebSocketOptionsWithCertificates,
  deleteWsConnection,
  sendWsRequest,
  wsConnections,
} from './wsCore';
export type {WsConnection} from './wsCore';

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

let runnerNetworkConfig: NetworkConfig =
    cloneNetworkConfig(DEFAULT_NETWORK_CONFIG);

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

/** Generic send using the runner network config (HTTP / GraphQL / WS). */
export async function send(req: Request): Promise<Response> {
  if (!req.url) {
    throw new Error('URL is required');
  }
  const protocol = req.protocol || 'http';
  if (protocol === 'ws') {
    return sendWsRequest(req, runnerNetworkConfig);
  } else if (protocol === 'http' || protocol === 'graphql') {
    const httpReq: HttpRequest = {
      url: req.url,
      method: req.method,
      timeout: req.timeout,
      headers: req.headers,
      body: typeof req.body === 'string' ||
              (typeof Buffer !== 'undefined' && Buffer.isBuffer(req.body)) ?
          req.body :
          (req.body == null ? undefined : JSON.stringify(req.body)),
      query: req.query,
      cookies: req.cookies,
      abortSignal: req.abortSignal,
    };
    const httpRes = await sendHttpRequest(httpReq, runnerNetworkConfig);
    return {
      body: httpRes.body,
      headers: httpRes.headers,
      status: httpRes.status,
      statusText: httpRes.statusText,
      duration: httpRes.duration,
      errorMessage: httpRes.status < 0 ? httpRes.statusText : '',
      errorCode: '',
      warning: httpRes.warning,
    };
  } else {
    throw new Error(`Unsupported protocol: ${protocol}`);
  }
}
