import * as fs from 'fs';
import * as http from 'http';
import * as https from 'https';
import * as path from 'path';
import * as vscode from 'vscode';
import YAML from 'yaml';
import { mockParsePack, mockServer, variableReplacer, MockData as MockDataNS } from 'mmt-core';

type MockData = MockDataNS.MockData;

interface MockServerHandle {
  server: http.Server | https.Server;
  port: number;
  dispose: () => void;
}

const activeServers = new Map<string, MockServerHandle>();

function resolveFilePath(filePath: string, basePath: string): string {
  if (path.isAbsolute(filePath)) {
    return filePath;
  }
  return path.resolve(path.dirname(basePath), filePath);
}

export function isRunning(documentUri: string): boolean {
  return activeServers.has(documentUri);
}

export function stopMockServer(documentUri: string): void {
  const handle = activeServers.get(documentUri);
  if (handle) {
    handle.dispose();
    activeServers.delete(documentUri);
  }
}

export function stopAll(): void {
  for (const [uri, handle] of activeServers) {
    handle.dispose();
    activeServers.delete(uri);
  }
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

  if (protocol === 'https' && data.tls) {
    const certPath = resolveFilePath(data.tls.cert, filePath);
    const keyPath = resolveFilePath(data.tls.key, filePath);
    const tlsOptions: https.ServerOptions = {
      cert: fs.readFileSync(certPath),
      key: fs.readFileSync(keyPath),
    };
    if (data.tls.ca) {
      tlsOptions.ca = fs.readFileSync(resolveFilePath(data.tls.ca, filePath));
    }
    if (data.tls.requestCert) {
      tlsOptions.requestCert = true;
      tlsOptions.rejectUnauthorized = false;
    }
    server = https.createServer(tlsOptions, requestHandler);
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
      activeServers.set(documentUri, handle);

      webviewPanel.webview.postMessage({
        command: 'mockServerStatus',
        running: true,
        port: data.port,
      });

      vscode.window.showInformationMessage(`Mock server running on ${protocol}://localhost:${data.port}`);
      resolve();
    });

    server.on('close', () => {
      activeServers.delete(documentUri);
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
      activeServers.delete(documentUri);
      if (err.code === 'EADDRINUSE') {
        vscode.window.showErrorMessage(`Mock server: port ${data.port} is already in use.`);
      } else {
        vscode.window.showErrorMessage(`Mock server error: ${err.message}`);
      }
      reject(err);
    });

    server.listen(data.port, '127.0.0.1');
  });
}
