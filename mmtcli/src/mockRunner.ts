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
import {findProjectRootSync, resolveCertFilePath} from 'mmt-core/fileHelper';

const {mockParsePack, mockServer, variableReplacer} = mmtcore;

type GeneratedTlsMaterial = {
  cert: string;
  key: string;
};

/** Track active servers so we can clean them all up at exit. */
const activeServers = new Map<string, {server: http.Server | https.Server; port: number; dispose: () => void}>();
let generatedDefaultTlsMaterial: GeneratedTlsMaterial | undefined;

function getDefaultMockTlsMaterial(): GeneratedTlsMaterial {
  if (generatedDefaultTlsMaterial) {
    return generatedDefaultTlsMaterial;
  }

  // Generate a localhost-only self-signed cert at runtime so the CLI
  // does not embed or distribute a static private key.
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

  const subject = [{name: 'commonName', value: 'localhost'}];
  certificate.setSubject(subject);
  certificate.setIssuer(subject);
  certificate.setExtensions([
    {name: 'basicConstraints', cA: false},
    {name: 'keyUsage', digitalSignature: true, keyEncipherment: true},
    {name: 'extKeyUsage', serverAuth: true},
    {
      name: 'subjectAltName',
      altNames: [
        {type: 2, value: 'localhost'},
        {type: 7, ip: '127.0.0.1'},
        {type: 7, ip: '::1'},
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
    const processor = (mmtcore as any).dataImportProcessor;
    const processedContent = processor?.processDataImportsInYaml ?
      await processor.processDataImportsInYaml({
        rawText: rawContent,
        filePath,
        projectRoot: findProjectRootSync(filePath, fs.existsSync, path.dirname, path.join) ?? undefined,
        fileLoader: async (p: string) => fs.readFileSync(p, 'utf-8'),
      }) :
      rawContent;
    parsed = yaml.load(processedContent);
  } catch (err: any) {
    throw new Error(`Mock server: YAML parse error in ${path.basename(filePath)}: ${err.message}`);
  }

  const {data, errors} = mockParsePack.parseMockData(parsed);
  if (errors.length > 0 || !data) {
    const msg = errors.map((e: any) => e.message).join('; ');
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
      let pathname = urlStr;
      const queryObj: Record<string, string> = {};
      const qIdx = urlStr.indexOf('?');
      if (qIdx >= 0) {
        pathname = urlStr.slice(0, qIdx);
        const searchParams = new URLSearchParams(urlStr.slice(qIdx + 1));
        searchParams.forEach((v, k) => { queryObj[k] = v; });
      }

      const parsedBody = mockServer.parseRequestBody(body, (req.headers || {}) as Record<string, string>);

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
