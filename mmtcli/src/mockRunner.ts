/**
 * CLI mock server runner – starts HTTP/HTTPS mock servers from .mmt server files.
 * Mirrors the functionality in src/mmtAPI/mockRunner.ts but without VS Code dependencies.
 */
import fs from 'fs';
import http from 'http';
import https from 'https';
import path from 'path';
import * as mmtcore from 'mmt-core';
import {findProjectRootSync, resolveCertFilePath} from 'mmt-core/fileHelper';
import {dispatchMockHttpRequest} from 'mmt-core/mockDispatch';
import {buildMockHttpsOptions} from 'mmt-core/mockTlsMaterial';

const {mockParsePack, mockServer, variableReplacer} = mmtcore;

/** Track active servers so we can clean them all up at exit. */
const activeServers = new Map<string, {server: http.Server | https.Server; port: number; dispose: () => void}>();

function resolveFilePath(relative: string, basePath: string): string {
  return resolveCertFilePath(relative, {baseFilePath: basePath});
}

function isSecureMockProtocol(protocol: string): boolean {
  return protocol === 'https';
}

function createHttpsMockServer(
    data: any,
    filePath: string,
    requestHandler: http.RequestListener): https.Server {
  const tlsOptions = buildMockHttpsOptions(
      data.connection,
      (abs) => fs.readFileSync(abs),
      (rel) => resolveFilePath(rel, filePath),
  );
  return https.createServer(tlsOptions, requestHandler);
}

/**
 * Start a mock server from a .mmt server file.
 * Returns a cleanup function that stops the server.
 */
export async function startMockServerFromPath(
  filePath: string,
  envVars: Record<string, any> = {},
): Promise<() => void> {
  // Stop existing server on this path if any
  const existing = activeServers.get(filePath);
  if (existing) {
    existing.dispose();
  }

  const rawContent = fs.readFileSync(filePath, 'utf-8');
  let processedContent = rawContent;
  try {
    const processor = (mmtcore as any).dataImportProcessor;
    processedContent = processor?.processDataImportsInYaml ?
      await processor.processDataImportsInYaml({
        rawText: rawContent,
        filePath,
        projectRoot: findProjectRootSync(filePath, fs.existsSync, path.dirname, path.join) ?? undefined,
        fileLoader: async (p: string) => fs.readFileSync(p, 'utf-8'),
      }) :
      rawContent;
  } catch (err: any) {
    throw new Error(`Mock server: YAML parse error in ${path.basename(filePath)}: ${err.message}`);
  }

  const {data, errors} = mockParsePack.loadMockFromYaml(processedContent);
  if (errors.length > 0 || !data) {
    const msg = errors.map((e: any) => e.message).join('; ') || 'Invalid mock server file';
    throw new Error(`Mock server validation errors in ${path.basename(filePath)}: ${msg}`);
  }

  const listenPort = mockParsePack.resolveMockPort(data.port, envVars);
  const listenProtocol = mockParsePack.resolveMockProtocol(data.protocol, envVars);
  data.port = listenPort;
  data.protocol = listenProtocol;

  // Check if a server is already running on this port
  for (const [, handle] of activeServers) {
    if (handle.port === listenPort) {
      // Server already running on this port — return a no‑op cleanup
      return () => {};
    }
  }

  // Create token resolver
  const tokenResolver = (value: any): any => {
    variableReplacer.resetRandomTokenCache();
    variableReplacer.resetCurrentTokenCache();
    return variableReplacer.resolveEmbeddedTokens(value, envVars);
  };

  // Resolve tokens in global headers
  if (data.headers) {
    for (const [k, v] of Object.entries(data.headers)) {
      if (typeof v === 'string') {
        (data.headers as Record<string, string>)[k] = String(variableReplacer.resolveEmbeddedTokens(v, envVars));
      }
    }
  }

  // Build the router
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
    req.on('data', (chunk: Buffer) => { body += chunk; });
    req.on('end', async () => {
      let result: ReturnType<typeof dispatchMockHttpRequest>;
      try {
        result = dispatchMockHttpRequest(router, {
          method,
          url: urlStr,
          headers: (req.headers || {}) as Record<string, string>,
          rawBody: body,
          resolveHeaderToken: (v) => String(variableReplacer.resolveEmbeddedTokens(v, envVars)),
        });
      } catch (err: any) {
        res.statusCode = 500;
        res.end(JSON.stringify({error: 'Mock router error', message: err.message}));
        return;
      }

      if (result.delay > 0) {
        await new Promise<void>(resolve => setTimeout(resolve, result.delay));
      }

      res.statusCode = result.status;
      for (const [k, v] of Object.entries(result.headers)) {
        res.setHeader(k, v);
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
        activeServers.delete(filePath);
      };

      activeServers.set(filePath, {server, port: listenPort, dispose});
      resolve(dispose);
    });

    server.on('error', (err: any) => {
      activeServers.delete(filePath);
      if (err.code === 'EADDRINUSE') {
        reject(new Error(`Mock server: port ${listenPort} is already in use.`));
      } else {
        reject(new Error(`Mock server error: ${err.message}`));
      }
    });

    server.listen(listenPort);
  });
}

/** Stop all active mock servers. */
export function stopAllServers(): void {
  for (const [, handle] of activeServers) {
    handle.dispose();
  }
  activeServers.clear();
}
