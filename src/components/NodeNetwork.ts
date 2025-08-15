import axios from 'axios';
import * as fs from 'fs';
import {stat} from 'fs';
import * as https from 'https';
import * as vscode from 'vscode';
import WebSocket from 'ws';

export type NetworkMessage =|{
  command: 'network', action: 'http-send';
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: any;
  query?: any;
  cookies?: Record<string, string>;
  requestId: string;
}
|{
  command: 'network', action: 'cancel';
  requestId: string;
}
|{
  command: 'network', action: 'ws-connect';
  url: string;
  wsId: string
}
|{
  command: 'network', action: 'ws-send';
  wsId: string;
  data: string
}
|{
  command: 'network', action: 'ws-disconnect';
  wsId: string
};

// Certificate interfaces
interface CaCertificate {
  enabled: boolean;
  certPath: string;
}

interface ClientCertificate {
  id: string;
  name: string;
  host: string;
  certPath: string;
  keyPath: string;
  enabled: boolean;
}

function getConfiguration() {
  const config = vscode.workspace.getConfiguration('multimeter');

  return {
    ca: config.get<CaCertificate>(
        'certificates.ca', {enabled: false, certPath: ''}),
    clients: config.get<ClientCertificate[]>('certificates.clients', []),
    sslValidation: config.get<boolean>('enableCertificateValidation', true),
    timeout: config.get<number>('network.timeout', 30000)
  };
}

function createHttpsAgentWithCertificates(hostname: string) {
  const certConfig = getConfiguration();

  const agentOptions:
      https.AgentOptions = {rejectUnauthorized: certConfig.sslValidation};

  // Add CA certificate if configured
  if (certConfig.ca.enabled && certConfig.ca.certPath) {
    try {
      const caCertData = fs.readFileSync(certConfig.ca.certPath);
      agentOptions.ca = [caCertData];
    } catch (error) {
      console.error('Failed to load CA certificate:', error);
      vscode.window.showErrorMessage(`Failed to load CA certificate: ${error}`);
    }
  }

  // Find matching client certificate for this host
  const matchingClientCert = certConfig.clients.find(
      cert => cert.enabled &&
          (cert.host === hostname || hostname.includes(cert.host) ||
           cert.host === '*'));

  if (matchingClientCert && matchingClientCert.certPath &&
      matchingClientCert.keyPath) {
    try {
      agentOptions.cert = fs.readFileSync(matchingClientCert.certPath);
      agentOptions.key = fs.readFileSync(matchingClientCert.keyPath);
    } catch (error) {
      console.error('Failed to load client certificate:', error);
      vscode.window.showErrorMessage(
          `Failed to load client certificate for ${hostname}: ${error}`);
    }
  }

  return new https.Agent(agentOptions);
}

function createWebSocketOptionsWithCertificates(hostname: string) {
  const certConfig = getConfiguration();

  const wsOptions: any = {rejectUnauthorized: certConfig.sslValidation};

  // Add CA certificate if configured
  if (certConfig.ca.enabled && certConfig.ca.certPath) {
    try {
      const caCertData = fs.readFileSync(certConfig.ca.certPath);
      wsOptions.ca = [caCertData];
    } catch (error) {
      console.error('Failed to load CA certificate for WebSocket:', error);
    }
  }

  // Find matching client certificate for this host
  const matchingClientCert = certConfig.clients.find(
      cert => cert.enabled &&
          (cert.host === hostname || hostname.includes(cert.host) ||
           cert.host === '*'));

  if (matchingClientCert && matchingClientCert.certPath &&
      matchingClientCert.keyPath) {
    try {
      wsOptions.cert = fs.readFileSync(matchingClientCert.certPath);
      wsOptions.key = fs.readFileSync(matchingClientCert.keyPath);
    } catch (error) {
      console.error('Failed to load client certificate for WebSocket:', error);
    }
  }

  return wsOptions;
}

export function handleNetworkMessage(
    message: NetworkMessage, webviewPanel: vscode.WebviewPanel,
    wsConnections: Record<string, WebSocket>) {
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

          // Get configuration including timeout
          const config = getConfiguration();

          // Create HTTPS agent with certificates for HTTPS requests
          const httpsAgent = parsedUrl.protocol === 'https:' ?
              createHttpsAgentWithCertificates(hostname) :
              undefined;

          let request = {
            url: url,
            method,
            data: body,
            params: query,
            withCredentials: true,
            headers: reqHeaders,
            httpsAgent,
            timeout: config.timeout,  // Use timeout from config
          };

          lastSendTime = Date.now();
          const response = await axios.request(request);
          const duration = lastSendTime ? Date.now() - lastSendTime : -1;

          webviewPanel.webview.postMessage({
            command: 'network',
            action: 'http-response',
            data: {
              body: response.data,
              headers: response.headers,
              status: response.status,
              statusText: response.statusText,
              duration: duration,
            },
            requestId,
          });

        } catch (err: any) {
          const duration = lastSendTime ? Date.now() - lastSendTime : -1;
          let errorMessage = err?.message || String(err);
          let status = err?.response?.status;
          let responseBody = null;
          let responseHeaders = null;

          // Extract response data safely, avoiding circular references
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

          webviewPanel.webview.postMessage({
            command: 'network',
            action: 'http-error',
            data: {
              body: responseBody,
              headers: responseHeaders,
              status: status,
              message: errorMessage,
              code: err.code,
              duration: duration,
            },
            requestId: message.requestId,
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
          wsOptions = createWebSocketOptionsWithCertificates(hostname);
        }

        const ws = new WebSocket(url, wsOptions);
        wsConnections[wsId] = ws;

        ws.on('open', () => {
          webviewPanel.webview.postMessage(
              {command: 'network', action: 'ws-open', wsId});
        });

        ws.on('close', (code, reason) => {
          webviewPanel.webview.postMessage({
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

          webviewPanel.webview.postMessage({
            command: 'network',
            action: 'ws-error',
            wsId,
            error: errorMessage
          });
        });

        ws.on('message', (data) => {
          webviewPanel.webview.postMessage({
            command: 'network',
            action: 'ws-message',
            wsId,
            data: data.toString()
          });
        });

      } catch (err: any) {
        webviewPanel.webview.postMessage({
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
        webviewPanel.webview.postMessage({
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
        webviewPanel.webview.postMessage(
            {command: 'network', action: 'ws-close', wsId});
      }
    } break;
  }
}

// Helper function to get certificate status for a URL (useful for UI feedback)
export function getCertificateStatusForUrl(url: string) {
  try {
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname;
    const certConfig = getConfiguration();

    const hasMatchingClientCert = certConfig.clients.some(
        cert => cert.enabled &&
            (cert.host === hostname || hostname.includes(cert.host) ||
             cert.host === '*'));

    return {
      protocol: parsedUrl.protocol,
      hostname,
      sslValidation: certConfig.sslValidation,
      hasCA: certConfig.ca.enabled && certConfig.ca.certPath,
      hasClientCert: hasMatchingClientCert,
      isSecure: parsedUrl.protocol === 'https:' || parsedUrl.protocol === 'wss:'
    };
  } catch {
    return null;
  }
}