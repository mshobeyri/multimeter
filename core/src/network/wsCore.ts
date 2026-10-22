import WebSocket from 'ws';

import {findMatchingClientCertificate, NetworkConfig, Request, Response,} from '../data/NetworkData';
import {isLocalMmtDevHostname} from './localTestServer';
import {applyTlsCompatibilityOptions} from './httpTls';
import {
  createLocalMmtDevWebSocket,
  LocalMmtDevWebSocket,
} from './localMmtDevTransport';

export async function sendWsRequest(
    req: Request, config: NetworkConfig): Promise<Response> {
  return new Promise((resolve, reject) => {
    const url = req.url!;
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname;
    let ws: WebSocket|LocalMmtDevWebSocket;
    if (isLocalMmtDevHostname(hostname)) {
      ws = createLocalMmtDevWebSocket();
    } else {
      let wsOptions = {};
      if (parsedUrl.protocol === 'wss:') {
        wsOptions = createWebSocketOptionsWithCertificates(
            hostname, parsedUrl.port, parsedUrl.protocol, config);
      }
      ws = new WebSocket(url, wsOptions);
    }
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
  if (isLocalMmtDevHostname(hostname)) {
    return {ws: createLocalMmtDevWebSocket() as unknown as WebSocket, wsId};
  }
  let wsOptions = {};
  if (parsedUrl.protocol === 'wss:') {
    wsOptions = createWebSocketOptionsWithCertificates(
        hostname, parsedUrl.port, parsedUrl.protocol, config);
  }
  const ws = new WebSocket(url, wsOptions);
  return {ws, wsId};
}

export function createWebSocketOptionsWithCertificates(
    hostname: string, port: string|undefined, protocol: string|undefined,
    config: NetworkConfig, opts?: {skipCertificateValidation?: boolean}) {
  const rejectUnauthorized =
      opts?.skipCertificateValidation ? false : config.sslValidation;
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
  const matchingClientCert =
      findMatchingClientCertificate(config.clients, hostname, port, protocol);
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
