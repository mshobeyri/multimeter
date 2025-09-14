import axios from 'axios';
import * as https from 'https';
import WebSocket from 'ws';

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

export interface NetworkConfig {
  ca: CaCertificate;
  clients: ClientCertificate[];
  sslValidation: boolean;
  timeout: number;
  autoFormat: boolean;
}

export type PostMessage = (msg: any) => void;

// --- Core Certificate/WS Option Functions ---

function createHttpsAgentWithCertificates(
    hostname: string, config: NetworkConfig) {
  const agentOptions:
      https.AgentOptions = {rejectUnauthorized: config.sslValidation};

  // Add CA certificate if configured
  if (config.ca.enabled && config.ca.certData) {
    agentOptions.ca = [config.ca.certData];
  }

  // Find matching client certificate for this host
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

function createWebSocketOptionsWithCertificates(
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

// --- Main Handler ---

export function handleNetworkMessage(
    message: NetworkMessage, wsConnections: Record<string, WebSocket>,
    config: NetworkConfig, postMessage: PostMessage) {
  switch (message.action) {
    case 'http-send':
      (async () => {
        let lastSendTime: number|null = null;
        try {
          const {
            url,
            method = 'get',
            headers = {},
            body,
            query,
            cookies,
            requestId
          } = message;

          // Parse URL to get hostname for certificate matching
          const parsedUrl = new URL(url);
          const hostname = parsedUrl.hostname;

          let reqHeaders = {...headers};
          if (cookies && Object.keys(cookies).length > 0) {
            reqHeaders['Cookie'] =
                Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ');
          }

          // Create HTTPS agent with certificates for HTTPS requests
          const httpsAgent = parsedUrl.protocol === 'https:' ?
              createHttpsAgentWithCertificates(hostname, config) :
              undefined;

          let request = {
            url: url,
            method,
            data: body,
            params: query,
            withCredentials: true,
            headers: reqHeaders,
            httpsAgent,
            timeout: config.timeout,
            responseType: 'text' as const,
            transformResponse: [function(data: string) {
              return data;
            }]
          };

          lastSendTime = Date.now();
          const response = await axios.request(request);
          const duration = lastSendTime ? Date.now() - lastSendTime : -1;

          postMessage({
            command: 'network',
            action: 'http-response',
            data: {
              body: response.data,
              headers: response.headers,
              status: response.status,
              statusText: response.statusText,
              duration: duration,
              autoformat: config.autoFormat
            },
            requestId
          });
        } catch (err: any) {
          const duration = lastSendTime ? Date.now() - lastSendTime : -1;
          let errorMessage = err?.message || String(err);
          let status = err?.response?.status;
          let responseBody = null;
          let responseHeaders = null;

          if (err.response) {
            responseBody = err.response.data;
            responseHeaders = err.response.headers;
            status = err.response.status;
          }

          // Provide better error messages for certificate issues
          if (err.code === 'CERT_UNTRUSTED') {
            errorMessage =
                'Certificate validation failed. The server certificate is not trusted. Check your CA certificate configuration or disable SSL validation.';
          } else if (err.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE') {
            errorMessage =
                'Unable to verify certificate. The certificate chain is incomplete or invalid.';
          } else if (err.code === 'SELF_SIGNED_CERT_IN_CHAIN') {
            errorMessage =
                'Self-signed certificate in chain. Add the CA certificate or disable SSL validation.';
          } else if (err.code === 'CERT_HAS_EXPIRED') {
            errorMessage =
                'Certificate has expired. Please update the certificate.';
          } else if (err.code === 'ECONNREFUSED') {
            errorMessage = 'Connection refused. The server is not responding.';
          } else if (err.code === 'ENOTFOUND') {
            errorMessage = 'Host not found. Check the URL.';
          }

          postMessage({
            command: 'network',
            action: 'http-error',
            data: {
              body: responseBody,
              headers: responseHeaders,
              status: status,
              message: errorMessage,
              code: err.code,
              duration: duration,
              autoformat: config.autoFormat
            },
            requestId: message.requestId
          });
        }
      })();
      break;

    case 'ws-connect':
      try {
        const {url, wsId} = message;

        // Close existing connection if any
        if (wsConnections[wsId]) {
          wsConnections[wsId].close();
          delete wsConnections[wsId];
        }

        // Parse URL to get hostname for certificate matching
        const parsedUrl = new URL(url);
        const hostname = parsedUrl.hostname;

        // Create WebSocket with certificate options for WSS connections
        let wsOptions = {};
        if (parsedUrl.protocol === 'wss:') {
          wsOptions = createWebSocketOptionsWithCertificates(hostname, config);
        }

        const ws = new WebSocket(url, wsOptions);
        wsConnections[wsId] = ws;

        ws.on('open', () => {
          postMessage({command: 'network', action: 'ws-open', wsId});
        });

        ws.on('close', (code, reason) => {
          postMessage({
            command: 'network',
            action: 'ws-close',
            wsId,
            code,
            reason: reason?.toString()
          });
          delete wsConnections[wsId];
        });

        ws.on('error', (error) => {
          let errorMessage = error?.message || String(error);

          // Provide better error messages for WebSocket certificate issues
          if (error.message?.includes('certificate')) {
            errorMessage =
                'WebSocket certificate error. Check your certificate configuration.';
          }

          postMessage({
            command: 'network',
            action: 'ws-error',
            wsId,
            error: errorMessage
          });
        });

        ws.on('message', (data) => {
          postMessage({
            command: 'network',
            action: 'ws-message',
            wsId,
            data: data.toString(),
            autoformat: config.autoFormat
          });
        });
      } catch (err: any) {
        postMessage({
          command: 'network',
          action: 'ws-error',
          wsId: (message as any).wsId,
          error: err?.message || String(err)
        });
      }
      break;

    case 'ws-send': {
      const {wsId, data} = message;
      const ws = wsConnections[wsId];
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(typeof data === 'string' ? data : JSON.stringify(data));
      } else {
        postMessage({
          command: 'network',
          action: 'ws-error',
          wsId,
          error: 'WebSocket not open'
        });
      }
    } break;

    case 'ws-disconnect': {
      const {wsId} = message;
      const ws = wsConnections[wsId];
      if (ws) {
        ws.close();
        delete wsConnections[wsId];
        postMessage({command: 'network', action: 'ws-close', wsId});
      }
    } break;
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