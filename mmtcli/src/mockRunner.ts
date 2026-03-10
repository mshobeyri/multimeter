/**
 * CLI mock server runner – starts HTTP/HTTPS mock servers from .mmt server files.
 * Mirrors the functionality in src/mmtAPI/mockRunner.ts but without VS Code dependencies.
 */
import fs from 'fs';
import http from 'http';
import https from 'https';
import path from 'path';
import yaml from 'js-yaml';
import * as mmtcore from 'mmt-core';

const {mockParsePack, mockServer, variableReplacer} = mmtcore;

/** Track active servers so we can clean them all up at exit. */
const activeServers = new Map<string, {server: http.Server | https.Server; port: number; dispose: () => void}>();

function resolveFilePath(relative: string, basePath: string): string {
  if (path.isAbsolute(relative)) {
    return relative;
  }
  return path.resolve(path.dirname(basePath), relative);
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
  let parsed: any;
  try {
    parsed = yaml.load(rawContent);
  } catch (err: any) {
    throw new Error(`Mock server: YAML parse error in ${path.basename(filePath)}: ${err.message}`);
  }

  const {data, errors} = mockParsePack.parseMockData(parsed);
  if (errors.length > 0 || !data) {
    const msg = errors.map((e: any) => e.message).join('; ');
    throw new Error(`Mock server validation errors in ${path.basename(filePath)}: ${msg}`);
  }

  // Check if a server is already running on this port
  for (const [, handle] of activeServers) {
    if (handle.port === data.port) {
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
      let pathname = urlStr;
      const queryObj: Record<string, string> = {};
      const qIdx = urlStr.indexOf('?');
      if (qIdx >= 0) {
        pathname = urlStr.slice(0, qIdx);
        const searchParams = new URLSearchParams(urlStr.slice(qIdx + 1));
        searchParams.forEach((v, k) => { queryObj[k] = v; });
      }

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
        res.end(JSON.stringify({error: 'Mock router error', message: err.message}));
        return;
      }

      // Apply delay
      if (mockRes.delay && mockRes.delay > 0) {
        await new Promise<void>(resolve => setTimeout(resolve, mockRes.delay));
      }

      // Resolve tokens in response headers per-request
      if (mockRes.headers) {
        for (const [k, v] of Object.entries(mockRes.headers)) {
          if (typeof v === 'string') {
            res.setHeader(k, String(variableReplacer.resolveEmbeddedTokens(v, envVars)));
          } else {
            res.setHeader(k, v);
          }
        }
      }

      res.statusCode = mockRes.status;
      const responseBody = mockRes.body !== undefined ? (
        typeof mockRes.body === 'string' ? mockRes.body : JSON.stringify(mockRes.body)
      ) : '';
      res.end(responseBody);
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

      activeServers.set(filePath, {server, port: data.port, dispose});
      resolve(dispose);
    });

    server.on('error', (err: any) => {
      activeServers.delete(filePath);
      if (err.code === 'EADDRINUSE') {
        reject(new Error(`Mock server: port ${data.port} is already in use.`));
      } else {
        reject(new Error(`Mock server error: ${err.message}`));
      }
    });

    server.listen(data.port);
  });
}

/** Stop all active mock servers. */
export function stopAllServers(): void {
  for (const [, handle] of activeServers) {
    handle.dispose();
  }
  activeServers.clear();
}
