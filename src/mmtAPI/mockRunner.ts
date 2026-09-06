import * as fs from 'fs';
import * as http from 'http';
import * as https from 'https';
import * as path from 'path';
import {findProjectRootSync, resolveCertFilePath} from 'mmt-core/fileHelper';
import * as vscode from 'vscode';
import * as mmtcore from 'mmt-core';
import { mockParsePack, mockServer, variableReplacer, MockData as MockDataNS } from 'mmt-core';
import {dispatchMockHttpRequest} from 'mmt-core/mockDispatch';
import {buildMockHttpsOptions, getDefaultMockTlsMaterial} from 'mmt-core/mockTlsMaterial';

import {onRunFinished, onRunStarted} from '../runStatusBar';
import {keepMmtEditorSoon} from '../keepEditor';

type MockData = MockDataNS.MockData;

interface MockServerHandle {
  server: http.Server | https.Server;
  port: number;
  dispose: () => void;
  statusBarRunId?: string;
}

const activeServers = new Map<string, MockServerHandle>();

export {getDefaultMockTlsMaterial};

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
  const tlsOptions = buildMockHttpsOptions(
      data.connection,
      (abs: string) => fs.readFileSync(abs),
      (rel: string) => resolveFilePath(rel, filePath),
  );
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

/** Extract env var dict from workspace environment storage. */
function extractEnvVars(mmtProvider: any): Record<string, any> {
  const envStorage = mmtProvider?.context?.workspaceState?.get(
    'multimeter.environment.storage', []) ?? [];
  const envVars: Record<string, any> = {};
  if (Array.isArray(envStorage)) {
    for (const item of envStorage) {
      if (!item || typeof item !== 'object') {
        continue;
      }
      const name = (item as any).name;
      if (typeof name === 'string' && name) {
        envVars[name] = (item as any).value;
      }
    }
  }
  return envVars;
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
  const { data, errors } = mockParsePack.loadMockFromYaml(rawContent);
  if (errors.length > 0 || !data) {
    const msg = errors.map(e => e.message).join('; ') || 'Invalid mock server file';
    vscode.window.showErrorMessage(`Mock server validation errors: ${msg}`);
    return;
  }

  // Load workspace environment variables so e:VAR / <<e:VAR>> resolve in responses
  const envVars = extractEnvVars(mmtProvider);

  let listenPort: number;
  let listenProtocol: MockDataNS.MockProtocol;
  try {
    listenPort = mockParsePack.resolveMockPort(data.port, envVars);
    listenProtocol = mockParsePack.resolveMockProtocol(data.protocol, envVars);
  } catch (err: any) {
    vscode.window.showErrorMessage(err?.message || String(err));
    return;
  }
  data.port = listenPort;
  data.protocol = listenProtocol;

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
      let result: ReturnType<typeof dispatchMockHttpRequest>;
      try {
        result = dispatchMockHttpRequest(router, {
          method,
          url: urlStr,
          headers: (req.headers || {}) as Record<string, string>,
          rawBody: body,
          resolveHeaderToken: (v: string) => String(variableReplacer.resolveEmbeddedTokens(v, envVars)),
        });
      } catch (err: any) {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: 'Mock router error', message: err.message }));
        return;
      }

      if (result.delay > 0) {
        await new Promise<void>(resolve => setTimeout(resolve, result.delay));
      }

      res.statusCode = result.status;
      for (const [k, v] of Object.entries(result.headers)) {
        res.setHeader(k, v as string);
      }
      res.end(result.body);

      const duration = Date.now() - startTime;
      const titleBase = urlStr;
      mmtProvider.historyManager.add({
        type: 'recv',
        method,
        protocol: 'mock',
        title: titleBase,
        headers: req.headers as any,
        query: result.query,
        cookies: {},
        content: body,
      });
      mmtProvider.historyManager.add({
        type: result.status >= 400 ? 'error' : 'send',
        method,
        protocol: 'mock',
        title: titleBase,
        headers: result.headers,
        cookies: {},
        content: result.body,
        status: result.status,
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
        port: listenPort,
        dispose: () => {
          try {
            server.close();
          } catch {
            // ignore
          }
        },
      };
      const label = `Mock server ${getMockUrlScheme(protocol)}://localhost:${listenPort}`;
      handle.statusBarRunId = onRunStarted(label, () => stopMockServer(documentUri), 'server');
      activeServers.set(documentUri, handle);

      // Keep preview tab open while the mock server is bound to this file.
      keepMmtEditorSoon(document.uri);

      webviewPanel.webview.postMessage({
        command: 'mockServerStatus',
        running: true,
        port: listenPort,
      });

      vscode.window.showInformationMessage(`Mock server running on ${getMockUrlScheme(protocol)}://localhost:${listenPort}`);
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
        vscode.window.showErrorMessage(`Mock server: port ${listenPort} is already in use.`);
      } else {
        vscode.window.showErrorMessage(`Mock server error: ${err.message}`);
      }
      reject(err);
    });

    server.listen(listenPort);
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
  let processedContent = rawContent;
  try {
    processedContent = await (mmtcore as any).dataImportProcessor.processDataImportsInYaml({
      rawText: rawContent,
      filePath,
      projectRoot: findProjectRootSync(filePath, fs.existsSync, path.dirname, path.join) ?? undefined,
      fileLoader: async (p: string) => fs.readFileSync(p, 'utf-8'),
    });
  } catch (err: any) {
    throw new Error(`Mock server: YAML parse error in ${path.basename(filePath)}: ${err.message}`);
  }

  const { data, errors } = mockParsePack.loadMockFromYaml(processedContent);
  if (errors.length > 0 || !data) {
    const msg = errors.map(e => e.message).join('; ') || 'Invalid mock server file';
    throw new Error(`Mock server validation errors in ${path.basename(filePath)}: ${msg}`);
  }

  const listenPort = mockParsePack.resolveMockPort(data.port, envVars);
  const listenProtocol = mockParsePack.resolveMockProtocol(data.protocol, envVars);
  data.port = listenPort;
  data.protocol = listenProtocol;

  // Check if a server is already running on this port (possibly started via Mock Server panel)
  const existingUri = findServerByPort(listenPort);
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
      let result: ReturnType<typeof dispatchMockHttpRequest>;
      try {
        result = dispatchMockHttpRequest(router, {
          method,
          url: urlStr,
          headers: (req.headers || {}) as Record<string, string>,
          rawBody: body,
          resolveHeaderToken: (v: string) => String(variableReplacer.resolveEmbeddedTokens(v, envVars)),
        });
      } catch (err: any) {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: 'Mock router error', message: err.message }));
        return;
      }

      if (result.delay > 0) {
        await new Promise<void>(resolve => setTimeout(resolve, result.delay));
      }

      res.statusCode = result.status;
      for (const [k, v] of Object.entries(result.headers)) {
        res.setHeader(k, v as string);
      }
      res.end(result.body);
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
        port: listenPort,
        dispose,
      };
      const protocol = data.protocol || 'http';
      const label = `Mock server ${getMockUrlScheme(protocol)}://localhost:${listenPort}`;
      handle.statusBarRunId = onRunStarted(label, () => stopMockServer(documentUri), 'server');
      activeServers.set(documentUri, handle);
      keepMmtEditorSoon(vscode.Uri.file(filePath));
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
        reject(new Error(`Mock server: port ${listenPort} is already in use.`));
      } else {
        reject(new Error(`Mock server error: ${err.message}`));
      }
    });

    server.listen(listenPort);
  });
}
