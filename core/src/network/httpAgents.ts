import * as http from 'http';
import * as https from 'https';

import {connectionTracker} from './connectionTracker';
import {findMatchingClientCertificate, NetworkConfig} from '../data/NetworkData';
import {
  applyTlsCompatibilityOptions,
  findUsableClientCertificateById,
} from './httpTls';

// Shared agent pools for connection reuse and tracking
const httpAgentPool: Map<string, http.Agent> = new Map();
const httpsAgentPool: Map<string, https.Agent> = new Map();

// Track socket -> connection ID mapping
const socketConnectionIds = new WeakMap<any, string>();
const trackedSockets = new WeakSet<any>();

function getHttpsAgentKey(
    hostname: string, port: string|undefined, protocol: string|undefined,
    config: NetworkConfig, opts?: {
      skipCertificateValidation?: boolean;
      fallbackClientCertId?: string;
      forceTls12?: boolean;
    }): string {
  const skipValidation = opts?.skipCertificateValidation ?? false;
  const clientId = opts?.fallbackClientCertId ||
      findMatchingClientCertificate(config.clients, hostname, port, protocol)
          ?.id ||
      '';
  return [
    hostname,
    port || '',
    String(config.sslValidation),
    String(skipValidation),
    String(!!config.ca.enabled),
    clientId,
    opts?.forceTls12 ? 'tls12' : 'tls',
  ].join(':');
}

function trackSocketForAgent(
    socket: any, host: string, protocol: 'http'|'https'): void {
  if (trackedSockets.has(socket)) {
    return;
  }
  trackedSockets.add(socket);

  const connId = connectionTracker.generateId();
  socketConnectionIds.set(socket, connId);

  connectionTracker.open({
    id: connId,
    host,
    protocol,
  });

  // Register close handler so user can close this socket
  connectionTracker.setCloseHandler(connId, () => {
    try {
      socket.destroy();
    } catch {
      // Ignore errors when destroying socket
    }
  });

  socket.once('connect', () => {
    connectionTracker.connected(connId);
  });

  if (protocol === 'https') {
    socket.once('secureConnect', () => {
      connectionTracker.connected(connId);
    });
  }

  socket.once('close', (hadError: boolean) => {
    connectionTracker.close(connId, hadError ? 'server' : 'client');
  });

  socket.once('error', () => {
    connectionTracker.close(connId, 'server');
  });

  socket.once('timeout', () => {
    connectionTracker.close(connId, 'timeout');
  });

  socket.once('end', () => {
    connectionTracker.close(connId, 'server');
    // The peer finished this connection. If no request is writing on it,
    // drop it so the agent cannot hand the closed socket to the next call.
    if (!socket._httpMessage) {
      destroySocketQuietly(socket);
    }
  });
}

function destroySocketQuietly(socket: any): void {
  if (!socket || socket.destroyed) {
    return;
  }
  try {
    socket.removeAllListeners('error');
    socket.on('error', () => {});
    socket.destroy();
  } catch {
    // Best-effort. The HTTP result is already decided.
  }
}

function requestSocket(source: any): any {
  return source?.request?.socket || source?.response?.request?.socket ||
      source?.socket;
}

export function dropKeepAliveSocket(source: any): void {
  destroySocketQuietly(requestSocket(source));
}

export function isDeadKeepAliveError(err: any): boolean {
  if (!err || err.response) {
    return false;
  }
  const code = err.code || err.cause?.code;
  if (code === 'ECONNRESET' || code === 'EPIPE') {
    return true;
  }
  const message =
      typeof err.message === 'string' ? err.message.toLowerCase() : '';
  return message.includes('socket hang up') || message.includes('econnreset');
}

export function createHttpsAgentWithCertificates(
    hostname: string, port: string|undefined, protocol: string|undefined,
    config: NetworkConfig, opts?: {
      skipCertificateValidation?: boolean;
      fallbackClientCertId?: string;
      forceTls12?: boolean;
    }): https.Agent {
  const skipValidation = opts?.skipCertificateValidation ?? false;
  const agentKey = getHttpsAgentKey(hostname, port, protocol, config, opts);
  const existingAgent = httpsAgentPool.get(agentKey);
  if (existingAgent) {
    return existingAgent;
  }
  const rejectUnauthorized = skipValidation ? false : config.sslValidation;
  const agentOptions: https.AgentOptions = {
    rejectUnauthorized,
    keepAlive: true,
    keepAliveMsecs: 30000,
  };
  applyTlsCompatibilityOptions(agentOptions, {forceTls12: opts?.forceTls12});
  // Handle CA certificates (can be array or single Buffer for backward compat)
  if (config.ca.enabled && config.ca.certData) {
    if (Array.isArray(config.ca.certData)) {
      agentOptions.ca = config.ca.certData;
    } else {
      agentOptions.ca = [config.ca.certData];
    }
  }
  const matchingClientCert = opts?.fallbackClientCertId ?
      findUsableClientCertificateById(config, opts.fallbackClientCertId) :
      findMatchingClientCertificate(config.clients, hostname, port, protocol);
  if (matchingClientCert) {
    if (matchingClientCert.pfxData) {
      agentOptions.pfx = matchingClientCert.pfxData;
    } else if (matchingClientCert.certData && matchingClientCert.keyData) {
      agentOptions.cert = matchingClientCert.certData;
      agentOptions.key = matchingClientCert.keyData;
    }
    if (matchingClientCert.passphrase_plain) {
      agentOptions.passphrase = matchingClientCert.passphrase_plain;
    }
  }

  const agent = new https.Agent(agentOptions);

  // Hook into agent to track socket creation
  // Note: createConnection exists on Agent but isn't in the type definitions
  const originalCreateConnection = (agent as any).createConnection.bind(agent);
  (agent as any).createConnection = function(options: any, callback: any) {
    const socket = originalCreateConnection(options, callback);
    const port = options.port || 443;
    const host = `${options.hostname || options.host || hostname}:${port}`;
    trackSocketForAgent(socket, host, 'https');
    return socket;
  };

  httpsAgentPool.set(agentKey, agent);
  return agent;
}

export function createHttpAgentWithTracking(hostname: string): http.Agent {
  const agentKey = `http:${hostname}`;

  const existingAgent = httpAgentPool.get(agentKey);
  if (existingAgent) {
    return existingAgent;
  }

  const agent = new http.Agent({
    keepAlive: true,
    keepAliveMsecs: 30000,
  });

  // Note: createConnection exists on Agent but isn't in the type definitions
  const originalCreateConnection = (agent as any).createConnection.bind(agent);
  (agent as any).createConnection = function(options: any, callback: any) {
    const socket = originalCreateConnection(options, callback);
    const port = options.port || 80;
    const host = `${options.hostname || options.host || hostname}:${port}`;
    trackSocketForAgent(socket, host, 'http');
    return socket;
  };

  httpAgentPool.set(agentKey, agent);
  return agent;
}

/** Record activity on a connection by socket */
export function recordConnectionActivity(socket: any): void {
  const connId = socketConnectionIds.get(socket);
  if (connId) {
    connectionTracker.activity(connId, {incrementRequests: true});
  }
}

/** Mark a connection as idle by socket */
export function markConnectionIdle(socket: any): void {
  const connId = socketConnectionIds.get(socket);
  if (connId) {
    connectionTracker.idle(connId);
  }
}

/** Close all HTTP/HTTPS agents and their connections */
export function closeAllHttpConnections(): void {
  for (const agent of httpsAgentPool.values()) {
    agent.destroy();
  }
  for (const agent of httpAgentPool.values()) {
    agent.destroy();
  }
  httpsAgentPool.clear();
  httpAgentPool.clear();
}
