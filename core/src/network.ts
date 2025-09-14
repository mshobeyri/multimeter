import WebSocket from 'ws';
import {
  NetworkConfig,
  sendHttpRequest,
  createWebSocket,
  HttpRequest,
} from './networkCore';

export { NetworkConfig, HttpRequest, HttpResponse } from './networkCore';
// --- Types ---

export type NetworkMessage =|{
  command: 'network';
  action: 'http-send';
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  query?: Record<string, string>;
  cookies?: Record<string, string>;
  requestId: string;
}
|{
  command: 'network';
  action: 'cancel';
  requestId: string;
}
|{
  command: 'network';
  action: 'ws-connect';
  url: string;
  wsId: string;
}
|{
  command: 'network';
  action: 'ws-send';
  wsId: string;
  data: string;
}
|{
  command: 'network';
  action: 'ws-disconnect';
  wsId: string;
};

// Certificate interfaces
export interface CaCertificate {
  enabled: boolean;
  certData?: Buffer;  // The CA certificate data (already loaded)
}

export interface ClientCertificate {
  id: string;
  name: string;
  host: string;
  certData?: Buffer;  // The client certificate data (already loaded)
  keyData?: Buffer;   // The client key data (already loaded)
  enabled: boolean;
}

export type PostMessage = (msg: any) => void;

export function handleNetworkMessage(
  message: NetworkMessage,
  wsConnections: Record<string, WebSocket>,
  config: NetworkConfig,
  postMessage: PostMessage
) {
  switch (message.action) {
    case 'http-send':
      (async () => {
        try {
          const { url, method, headers, body, query, cookies, requestId } = message;
          const req: HttpRequest = { url, method, headers, body, query, cookies };
          const response = await sendHttpRequest(req, config);
          postMessage({
            command: 'network',
            action: 'http-response',
            data: response,
            requestId,
          });
        } catch (err: any) {
          postMessage({
            command: 'network',
            action: 'http-error',
            data: {
              message: err?.message || String(err),
              code: err?.code,
              status: err?.status,
              body: err?.response?.data,
              headers: err?.response?.headers,
              duration: err?.duration,
              autoformat: config.autoFormat,
            },
            requestId: message.requestId,
          });
        }
      })();
      break;

    case 'ws-connect': {
      const { url, wsId } = message;
      if (wsConnections[wsId]) {
        wsConnections[wsId].close();
        delete wsConnections[wsId];
      }
      const { ws } = createWebSocket(url, wsId, config);
      wsConnections[wsId] = ws;
      ws.on('open', () => postMessage({ command: 'network', action: 'ws-open', wsId }));
      ws.on('close', (code, reason) => {
        postMessage({
          command: 'network',
          action: 'ws-close',
          wsId,
          code,
          reason: reason?.toString(),
        });
        delete wsConnections[wsId];
      });
      ws.on('error', (error) => {
        postMessage({
          command: 'network',
          action: 'ws-error',
          wsId,
          error: error?.message || String(error),
        });
      });
      ws.on('message', (data) => {
        postMessage({
          command: 'network',
          action: 'ws-message',
          wsId,
          data: data.toString(),
          autoformat: config.autoFormat,
        });
      });
      break;
    }

    case 'ws-send': {
      const { wsId, data } = message;
      const ws = wsConnections[wsId];
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(typeof data === 'string' ? data : JSON.stringify(data));
      } else {
        postMessage({
          command: 'network',
          action: 'ws-error',
          wsId,
          error: 'WebSocket not open',
        });
      }
      break;
    }

    case 'ws-disconnect': {
      const { wsId } = message;
      const ws = wsConnections[wsId];
      if (ws) {
        ws.close();
        delete wsConnections[wsId];
        postMessage({ command: 'network', action: 'ws-close', wsId });
      }
      break;
    }
  }
}

// Helper function to get certificate status for a URL (useful for UI feedback)
export function getCertificateStatusForUrl(url: string, config: NetworkConfig) {
  try {
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname;

    const hasMatchingClientCert = config.clients.some(
        cert => cert.enabled &&
            (cert.host === hostname || hostname.includes(cert.host) ||
             cert.host === '*'));

    return {
      protocol: parsedUrl.protocol,
      hostname,
      sslValidation: config.sslValidation,
      hasCA: config.ca.enabled && !!config.ca.certData,
      hasClientCert: hasMatchingClientCert,
      isSecure: parsedUrl.protocol === 'https:' || parsedUrl.protocol === 'wss:'
    };
  } catch {
    return null;
  }
}