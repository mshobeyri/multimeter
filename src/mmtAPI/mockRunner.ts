import * as fs from 'fs';
import * as http from 'http';
import * as https from 'https';
import * as path from 'path';
import {resolveCertFilePath} from 'mmt-core/fileHelper';
import * as vscode from 'vscode';
import YAML from 'yaml';
import { mockParsePack, mockServer, variableReplacer, MockData as MockDataNS } from 'mmt-core';

import {onRunFinished, onRunStarted} from '../runStatusBar';

type MockData = MockDataNS.MockData;

interface MockServerHandle {
  server: http.Server | https.Server;
  port: number;
  dispose: () => void;
  statusBarRunId?: string;
}

type GeneratedTlsMaterial = {
  cert: string;
  key: string;
};

const activeServers = new Map<string, MockServerHandle>();
let generatedDefaultTlsMaterial: GeneratedTlsMaterial | undefined;

export function getDefaultMockTlsMaterial(): GeneratedTlsMaterial {
  if (generatedDefaultTlsMaterial) {
    return generatedDefaultTlsMaterial;
  }

  // Generate a localhost-only self-signed cert at runtime so the extension
  // never ships a static private key in source or package contents.
  const forge = require('node-forge');
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const certificate = forge.pki.createCertificate();
  const now = new Date();
  const expiresAt = new Date(now);
  expiresAt.setFullYear(expiresAt.getFullYear() + 10);

  certificate.publicKey = keys.publicKey;
  certificate.serialNumber = Math.max(Date.now(), 1).toString(16);
  certificate.validity.notBefore = now;
  certificate.validity.notAfter = expiresAt;

  const subject = [{ name: 'commonName', value: 'localhost' }];
  certificate.setSubject(subject);
  certificate.setIssuer(subject);
  certificate.setExtensions([
    { name: 'basicConstraints', cA: false },
    { name: 'keyUsage', digitalSignature: true, keyEncipherment: true },
    { name: 'extKeyUsage', serverAuth: true },
    {
      name: 'subjectAltName',
      altNames: [
        { type: 2, value: 'localhost' },
        { type: 7, ip: '127.0.0.1' },
        { type: 7, ip: '::1' },
      ],
    },
  ]);
  certificate.sign(keys.privateKey, forge.md.sha256.create());

  generatedDefaultTlsMaterial = {
    cert: forge.pki.certificateToPem(certificate),
    key: forge.pki.privateKeyToPem(keys.privateKey),
  };

  return generatedDefaultTlsMaterial;
}

function resolveFilePath(filePath: string, basePath: string): string {
  return resolveCertFilePath(filePath, {baseFilePath: basePath});
}

function isSecureMockProtocol(protocol: string): boolean {
  return protocol === 'https';
}

function getMockUrlScheme(protocol: string): 'http' | 'https' {
  return isSecureMockProtocol(protocol) ? 'https' : 'http';
}

function createHttpsMockServer(
    data: MockData,
    filePath: string,
    requestHandler: http.RequestListener): https.Server {
  const connection = data.connection || {};
  const hasCustomCert = !!connection.cert || !!connection.key;
  if (hasCustomCert && (!connection.cert || !connection.key)) {
    throw new Error('connection.cert and connection.key must be provided together');
  }
  const defaultTlsMaterial = hasCustomCert ? undefined : getDefaultMockTlsMaterial();
  const tlsOptions: https.ServerOptions = {
    cert: connection.cert ? fs.readFileSync(resolveFilePath(connection.cert, filePath)) : defaultTlsMaterial!.cert,
    key: connection.key ? fs.readFileSync(resolveFilePath(connection.key, filePath)) : defaultTlsMaterial!.key,
  };
  if (connection.client_ca) {
    tlsOptions.ca = fs.readFileSync(resolveFilePath(connection.client_ca, filePath));
  }
  if (connection.mode === 'mtls') {
    if (!connection.client_ca) {
      throw new Error('connection.client_ca is required when connection.mode is mtls');
    }
    tlsOptions.requestCert = true;
    tlsOptions.rejectUnauthorized = true;
  }
  return https.createServer(tlsOptions, requestHandler);
}

export function isRunning(documentUri: string): boolean {
  return activeServers.has(documentUri);
}

export function stopMockServer(documentUri: string): void {
  const handle = activeServers.get(documentUri);
  if (handle) {
    handle.dispose();
    if (activeServers.get(documentUri) === handle) {
      activeServers.delete(documentUri);
      finishMockServerStatus(handle);
    }
  }
}

function finishMockServerStatus(handle: MockServerHandle): void {
  if (handle.statusBarRunId) {
    onRunFinished(handle.statusBarRunId);
    handle.statusBarRunId = undefined;
  }
}

export function stopAll(): void {
  for (const [uri, handle] of activeServers) {
    handle.dispose();
    if (activeServers.get(uri) === handle) {
      activeServers.delete(uri);
      finishMockServerStatus(handle);
    }
  }
}

/**
 * Check if any managed server is already running on the given port.
 * Returns the document URI if found, undefined otherwise.
 */
function findServerByPort(port: number): string | undefined {
  for (const [uri, handle] of activeServers) {
    if (handle.port === port) {
      return uri;
    }
  }
  return undefined;
}

export async function startMockServer(
  document: vscode.TextDocument,
  webviewPanel: vscode.WebviewPanel,
  mmtProvider: any,
): Promise<void> {
  const documentUri = document.uri.toString();

  // Stop existing server on this document if any
  stopMockServer(documentUri);

  const rawContent = document.getText();
  let parsed: any;
  try {
    parsed = YAML.parse(rawContent);
  } catch (err: any) {
    vscode.window.showErrorMessage(`Mock server: YAML parse error: ${err.message}`);
    return;
  }

  const { data, errors } = mockParsePack.parseMockData(parsed);
  if (errors.length > 0 || !data) {
    const msg = errors.map(e => e.message).join('; ');
    vscode.window.showErrorMessage(`Mock server validation errors: ${msg}`);
    return;
  }

  // Resolve environment variables
  const envVars: Record<string, string> = {};
  // Load workspace environment variables from mmtProvider if available
  if (mmtProvider?.getEnvVars) {
    const vars = mmtProvider.getEnvVars();
    if (vars && typeof vars === 'object') {
      Object.assign(envVars, vars);
    }
  }

  // Create token resolver using core's resolveEmbeddedTokens
  // This recursively walks objects/arrays and resolves r:, c:, e: and <<...>> tokens
  const tokenResolver = (value: any): any => {
    variableReplacer.resetRandomTokenCache();
    variableReplacer.resetCurrentTokenCache();
    return variableReplacer.resolveEmbeddedTokens(value, envVars);
  };

  // Also resolve tokens in global headers
  const resolvedGlobalHeaders: Record<string, string> | undefined = data.headers
    ? Object.fromEntries(
      Object.entries(data.headers).map(([k, v]) =>
        [k, typeof v === 'string' ? String(variableReplacer.resolveEmbeddedTokens(v, envVars)) : v])
    )
    : undefined;
  if (resolvedGlobalHeaders && data.headers) {
    Object.assign(data.headers, resolvedGlobalHeaders);
  }

  // Build the router from core
  const router = mockServer.createMockRouter(data, tokenResolver);
  const filePath = document.uri.fsPath;

  const requestHandler = (req: http.IncomingMessage, res: http.ServerResponse) => {
    const method = (req.method || 'GET').toLowerCase();
    const urlStr = req.url || '/';

    // Handle CORS preflight
    if (data.cors) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', '*');
      res.setHeader('Access-Control-Allow-Headers', '*');
      if (method === 'options') {
        res.statusCode = 204;
        res.end();
        return;
      }
    }

    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      const startTime = Date.now();

      // Parse URL for path and query
      let pathname = urlStr;
      const queryObj: Record<string, string> = {};
      const qIdx = urlStr.indexOf('?');
      if (qIdx >= 0) {
        pathname = urlStr.slice(0, qIdx);
        const searchParams = new URLSearchParams(urlStr.slice(qIdx + 1));
        searchParams.forEach((v, k) => { queryObj[k] = v; });
      }

      // Parse request body
      let parsedBody: any;
      try {
        parsedBody = JSON.parse(body);
      } catch {
        parsedBody = body || undefined;
      }

      const mockReq = {
        method,
        path: pathname,
        headers: (req.headers || {}) as Record<string, string>,
        query: queryObj,
        body: parsedBody,
      };

      let mockRes: ReturnType<typeof router>;
      try {
        mockRes = router(mockReq);
      } catch (err: any) {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: 'Mock router error', message: err.message }));
        return;
      }

      // Apply delay
      if (mockRes.delay && mockRes.delay > 0) {
        await new Promise<void>(resolve => setTimeout(resolve, mockRes.delay));
      }

      // Resolve tokens in response headers per-request
      const resolvedHeaders: Record<string, string> = {};
      if (mockRes.headers) {
        for (const [k, v] of Object.entries(mockRes.headers)) {
          resolvedHeaders[k] = typeof v === 'string'
            ? String(variableReplacer.resolveEmbeddedTokens(v, envVars))
            : v;
        }
      }

      // Set status and headers
      res.statusCode = mockRes.status;
      for (const [k, v] of Object.entries(resolvedHeaders)) {
        res.setHeader(k, v);
      }

      // Send body
      const responseBody = mockRes.body !== undefined ? (
        typeof mockRes.body === 'string' ? mockRes.body : JSON.stringify(mockRes.body)
      ) : '';
      res.end(responseBody);

      const duration = Date.now() - startTime;

      // Persist to history
      const titleBase = `${method.toUpperCase()} ${pathname}`;
      mmtProvider.historyManager.add({
        type: 'recv',
        method,
        protocol: 'mock',
        title: titleBase,
        headers: req.headers as any,
        query: queryObj,
        cookies: {},
        content: body,
      });
      mmtProvider.historyManager.add({
        type: mockRes.status >= 400 ? 'error' : 'send',
        method,
        protocol: 'mock',
        title: titleBase,
        headers: resolvedHeaders,
        cookies: {},
        content: responseBody,
        status: mockRes.status,
        duration,
      });
    });
  };

  // Create server based on protocol
  let server: http.Server | https.Server;
  const protocol = data.protocol || 'http';

  if (isSecureMockProtocol(protocol)) {
    server = createHttpsMockServer(data, filePath, requestHandler);
  } else {
    server = http.createServer(requestHandler);
  }

  return new Promise<void>((resolve, reject) => {
    server.on('listening', () => {
      const handle: MockServerHandle = {
        server,
        port: data.port,
        dispose: () => {
          try {
            server.close();
          } catch {
            // ignore
          }
        },
      };
      const label = `Mock server ${getMockUrlScheme(protocol)}://localhost:${data.port}`;
      handle.statusBarRunId = onRunStarted(label, () => stopMockServer(documentUri), 'server');
      activeServers.set(documentUri, handle);

      webviewPanel.webview.postMessage({
        command: 'mockServerStatus',
        running: true,
        port: data.port,
      });

      vscode.window.showInformationMessage(`Mock server running on ${getMockUrlScheme(protocol)}://localhost:${data.port}`);
      resolve();
    });

    server.on('close', () => {
      const handle = activeServers.get(documentUri);
      activeServers.delete(documentUri);
      if (handle) {
        finishMockServerStatus(handle);
      }
      try {
        webviewPanel.webview.postMessage({
          command: 'mockServerStatus',
          running: false,
        });
      } catch {
        // webview may be disposed
      }
    });

    server.on('error', (err: any) => {
      const handle = activeServers.get(documentUri);
      activeServers.delete(documentUri);
      if (handle) {
        finishMockServerStatus(handle);
      }
      if (err.code === 'EADDRINUSE') {
        vscode.window.showErrorMessage(`Mock server: port ${data.port} is already in use.`);
      } else {
        vscode.window.showErrorMessage(`Mock server error: ${err.message}`);
      }
      reject(err);
    });

    server.listen(data.port);
  });
}

/**
 * Start a mock server from a file path (for use in test/suite `run` steps).
 * Returns a cleanup function to stop the server.
 */
export async function startMockServerFromPath(
  filePath: string,
  envVars: Record<string, any> = {},
  onClose?: () => void,
): Promise<() => void> {
  // Use the file path as the identifier
  const documentUri = filePath;

  // Stop existing server on this path if any
  stopMockServer(documentUri);

  const rawContent = fs.readFileSync(filePath, 'utf-8');
  let parsed: any;
  try {
    parsed = YAML.parse(rawContent);
  } catch (err: any) {
    throw new Error(`Mock server: YAML parse error in ${path.basename(filePath)}: ${err.message}`);
  }

  const { data, errors } = mockParsePack.parseMockData(parsed);
  if (errors.length > 0 || !data) {
    const msg = errors.map(e => e.message).join('; ');
    throw new Error(`Mock server validation errors in ${path.basename(filePath)}: ${msg}`);
  }

  // Check if a server is already running on this port (possibly started via Mock Server panel)
  const existingUri = findServerByPort(data.port);
  if (existingUri) {
    // Server already running on this port - return a no-op cleanup
    // This makes the 'run' step idempotent
    return () => {};
  }

  // Create token resolver using core's resolveEmbeddedTokens
  const tokenResolver = (value: any): any => {
    variableReplacer.resetRandomTokenCache();
    variableReplacer.resetCurrentTokenCache();
    return variableReplacer.resolveEmbeddedTokens(value, envVars);
  };

  // Also resolve tokens in global headers
  const resolvedGlobalHeaders: Record<string, string> | undefined = data.headers
    ? Object.fromEntries(
      Object.entries(data.headers).map(([k, v]) =>
        [k, typeof v === 'string' ? String(variableReplacer.resolveEmbeddedTokens(v, envVars)) : v])
    )
    : undefined;
  if (resolvedGlobalHeaders && data.headers) {
    Object.assign(data.headers, resolvedGlobalHeaders);
  }

  // Build the router from core
  const router = mockServer.createMockRouter(data, tokenResolver);

  const requestHandler = (req: http.IncomingMessage, res: http.ServerResponse) => {
    const method = (req.method || 'GET').toLowerCase();
    const urlStr = req.url || '/';

    // Handle CORS preflight
    if (data.cors) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', '*');
      res.setHeader('Access-Control-Allow-Headers', '*');
      if (method === 'options') {
        res.statusCode = 204;
        res.end();
        return;
      }
    }

    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      // Parse URL for path and query
      let pathname = urlStr;
      const queryObj: Record<string, string> = {};
      const qIdx = urlStr.indexOf('?');
      if (qIdx >= 0) {
        pathname = urlStr.slice(0, qIdx);
        const searchParams = new URLSearchParams(urlStr.slice(qIdx + 1));
        searchParams.forEach((v, k) => { queryObj[k] = v; });
      }

      // Parse request body
      let parsedBody: any;
      try {
        parsedBody = JSON.parse(body);
      } catch {
        parsedBody = body || undefined;
      }

      const mockReq = {
        method,
        path: pathname,
        headers: (req.headers || {}) as Record<string, string>,
        query: queryObj,
        body: parsedBody,
      };

      let mockRes: ReturnType<typeof router>;
      try {
        mockRes = router(mockReq);
      } catch (err: any) {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: 'Mock router error', message: err.message }));
        return;
      }

      // Apply delay
      if (mockRes.delay && mockRes.delay > 0) {
        await new Promise<void>(resolve => setTimeout(resolve, mockRes.delay));
      }

      // Resolve tokens in response headers per-request
      const resolvedHeaders: Record<string, string> = {};
      if (mockRes.headers) {
        for (const [k, v] of Object.entries(mockRes.headers)) {
          resolvedHeaders[k] = typeof v === 'string'
            ? String(variableReplacer.resolveEmbeddedTokens(v, envVars))
            : v;
        }
      }

      // Set status and headers
      res.statusCode = mockRes.status;
      for (const [k, v] of Object.entries(resolvedHeaders)) {
        res.setHeader(k, v);
      }

      // Send body
      const responseBody = mockRes.body !== undefined ? (
        typeof mockRes.body === 'string' ? mockRes.body : JSON.stringify(mockRes.body)
      ) : '';
      res.end(responseBody);
    });
  };

  // Create server based on protocol
  let server: http.Server | https.Server;
  const protocol = data.protocol || 'http';

  if (isSecureMockProtocol(protocol)) {
    server = createHttpsMockServer(data, filePath, requestHandler);
  } else {
    server = http.createServer(requestHandler);
  }

  return new Promise<() => void>((resolve, reject) => {
    server.on('listening', () => {
      const dispose = () => {
        try {
          server.close();
        } catch {
          // ignore
        }
        const handle = activeServers.get(documentUri);
        if (handle) {
          activeServers.delete(documentUri);
          finishMockServerStatus(handle);
        }
      };

      const handle: MockServerHandle = {
        server,
        port: data.port,
        dispose,
      };
      const protocol = data.protocol || 'http';
      const label = `Mock server ${getMockUrlScheme(protocol)}://localhost:${data.port}`;
      handle.statusBarRunId = onRunStarted(label, () => stopMockServer(documentUri), 'server');
      activeServers.set(documentUri, handle);
      resolve(dispose);
    });

    server.on('close', () => {
      const handle = activeServers.get(documentUri);
      activeServers.delete(documentUri);
      if (handle) {
        finishMockServerStatus(handle);
      }
      onClose?.();
    });

    server.on('error', (err: any) => {
      const handle = activeServers.get(documentUri);
      activeServers.delete(documentUri);
      if (handle) {
        finishMockServerStatus(handle);
      }
      if (err.code === 'EADDRINUSE') {
        reject(new Error(`Mock server: port ${data.port} is already in use.`));
      } else {
        reject(new Error(`Mock server error: ${err.message}`));
      }
    });

    server.listen(data.port);
  });
}
