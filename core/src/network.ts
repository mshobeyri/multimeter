import WebSocket = require('ws');
import {connectionTracker} from './connectionTracker';
import {addWsConnection, createWebSocket, deleteWsConnection, sendHttpRequest, wsConnections} from './networkCoreNode';
import {HttpRequest, NetworkConfig, GrpcRequest} from './NetworkData';
import {sendGrpcRequest} from './grpcCore';

// Map wsId to connection tracker ID
const wsConnectionTrackerIds: Map<string, string> = new Map();

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
}
|{
  command: 'network';
  action: 'grpc-send';
  url: string;
  proto?: string;
  service: string;
  method: string;
  metadata?: Record<string, string>;
  message?: object;
  stream?: string;
  requestId: string;
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

export interface NetworkHandlerOptions {
  fileLoader?: (path: string) => Promise<string>;
  basePath?: string;
}

export function handleNetworkMessage(
    message: NetworkMessage, config: NetworkConfig, postMessage: PostMessage, options?: NetworkHandlerOptions) {
  switch (message.action) {
    case 'http-send':
      (async () => {
        const {url, method, headers, body, query, cookies, requestId} =
            message;
        try {
          const req: HttpRequest = {url, method, headers, body, query, cookies};
          const response = await sendHttpRequest(req, config);
          postMessage({
            command: 'network',
            action: 'http-response',
            data: response,
            requestId,
          });
        } catch (err: any) {
          // Send error back to the webview so it can be displayed
          postMessage({
            command: 'network',
            action: 'http-error',
            data: {
              body: null,
              headers: null,
              status: -1,
              message: err?.message || String(err),
              code: err?.code || 'NETWORK_ERROR',
              duration: null,
            },
            requestId,
          });
        }
      })();
      break;

    case 'ws-connect': {
      const {url, wsId} = message;
      if (wsConnections(wsId)) {
        // Close existing connection and clean up tracker
        const existingConnId = wsConnectionTrackerIds.get(wsId);
        if (existingConnId) {
          connectionTracker.close(existingConnId, 'client');
          wsConnectionTrackerIds.delete(wsId);
        }
        wsConnections(wsId).close();
        deleteWsConnection(wsId);
      }

      // Parse URL to get host info
      let host = 'unknown';
      let protocol: 'ws' | 'wss' = 'ws';
      try {
        const parsedUrl = new URL(url);
        host = `${parsedUrl.hostname}:${parsedUrl.port || (parsedUrl.protocol === 'wss:' ? 443 : 80)}`;
        protocol = parsedUrl.protocol === 'wss:' ? 'wss' : 'ws';
      } catch {
        // Use URL as-is if parsing fails
        host = url;
      }

      // Track connection in connectionTracker
      const connId = connectionTracker.generateId();
      wsConnectionTrackerIds.set(wsId, connId);
      connectionTracker.open({id: connId, host, protocol});

      const {ws} = createWebSocket(url, wsId, config);
      addWsConnection(wsId, ws);

      // Register close handler so user can close this WebSocket from the panel
      connectionTracker.setCloseHandler(connId, () => {
        try {
          ws.close();
          deleteWsConnection(wsId);
        } catch {
          // Ignore errors when closing WebSocket
        }
      });

      ws.on('open', () => {
        connectionTracker.connected(connId);
        postMessage({command: 'network', action: 'ws-open', wsId});
      });
      ws.on('close', (code: number, reason: Buffer) => {
        // Determine if server or client closed
        // code 1000 = normal closure (usually client), 1001+ = server/abnormal
        const closedBy = code === 1000 ? 'client' : 'server';
        connectionTracker.close(connId, closedBy);
        wsConnectionTrackerIds.delete(wsId);
        postMessage({
          command: 'network',
          action: 'ws-close',
          wsId,
          code,
          reason: reason?.toString(),
          closedBy,
        });
        deleteWsConnection(wsId);
      });
      ws.on('error', (error: Error) => {
        connectionTracker.close(connId, 'server');
        wsConnectionTrackerIds.delete(wsId);
        postMessage({
          command: 'network',
          action: 'ws-error',
          wsId,
          error: error?.message || String(error),
          code: 'WS_ERROR',
        });
      });
      ws.on('message', (data: WebSocket.RawData) => {
        connectionTracker.activity(connId, {incrementRequests: true});
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
      const {wsId, data} = message;
      const ws = wsConnections(wsId);
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(typeof data === 'string' ? data : JSON.stringify(data));
      } else {
        postMessage({
          command: 'network',
          action: 'ws-error',
          wsId,
          error: 'WebSocket not open',
          code: 'WS_NOT_OPEN',
        });
      }
      break;
    }

    case 'ws-disconnect': {
      const {wsId} = message;
      const ws = wsConnections(wsId);
      if (ws) {
        // Track client-initiated close
        const connId = wsConnectionTrackerIds.get(wsId);
        if (connId) {
          connectionTracker.close(connId, 'client');
          wsConnectionTrackerIds.delete(wsId);
        }
        ws.close();
        deleteWsConnection(wsId);
        postMessage({command: 'network', action: 'ws-close', wsId, closedBy: 'client'});
      }
      break;
    }

    case 'grpc-send':
      (async () => {
        const {url, proto, service, method, metadata, message: msg, stream, requestId} = message;
        try {
          const grpcReq: GrpcRequest = {
            url,
            proto: proto || 'reflect',
            service,
            method,
            metadata,
            message: msg,
            stream: stream as any,
          };
          const fileLoader = options?.fileLoader || (async () => { throw new Error('File loader not available'); });
          const response = await sendGrpcRequest(grpcReq, config, fileLoader, options?.basePath);
          postMessage({
            command: 'network',
            action: 'grpc-response',
            data: response,
            requestId,
          });
        } catch (err: any) {
          postMessage({
            command: 'network',
            action: 'grpc-error',
            data: {
              body: null,
              headers: null,
              status: -1,
              message: err?.message || String(err),
              code: err?.code || 'GRPC_ERROR',
              duration: null,
            },
            requestId,
          });
        }
      })();
      break;
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
      allowSelfSigned: config.allowSelfSigned,
      hasCA: config.ca.enabled && !!config.ca.certData,
      hasClientCert: hasMatchingClientCert,
      isSecure: parsedUrl.protocol === 'https:' || parsedUrl.protocol === 'wss:'
    };
  } catch {
    return null;
  }
}