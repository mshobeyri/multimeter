import { GraphQLConfig, GrpcConfig } from './APIData';

export interface Request {
  url?: string;
  protocol?: "http" | "ws" | "graphql" | "grpc" | undefined;
  format?: "json" | "xml" | "xmle" | "text" | undefined;
  method?: string;
  headers?: Record<string, string> | undefined;
  cookies?: Record<string, string> | undefined;
  query?: Record<string, string> | undefined;
  body?: any;
  graphql?: GraphQLConfig;
  grpc?: GrpcConfig;
}

export interface GrpcRequest {
  url: string;
  proto: string;
  service: string;
  method: string;
  metadata?: Record<string, string>;
  message?: object;
  stream?: 'server' | 'client' | 'bidi';
}

export interface GrpcResponse {
  body: string;
  metadata: Record<string, string>;
  status: number;
  statusText: string;
  duration: number;
}

export interface Response {
  format?: "json" | "xml" | "xmle" | "text" | undefined;
  headers?: Record<string, string> | undefined;
  cookies?: Record<string, string> | undefined;
  query?: Record<string, string> | undefined;
  body?: any;
  status?: number | -1;
  duration?: number | -1;
  errorMessage: string | "";
  errorCode: string | "";
}

export interface NetworkAPI {
  // Common
  send: (requestData: Request | undefined) => Promise<Response | undefined>;
  loading: boolean;
  cancel: () => Promise<void>;

  // WebSocket
  connectWs: (url: string) => Promise<Response | undefined>;
  connecting: boolean;
  connected: boolean;
  closeWs: () => void;

  // gRPC
  sendGrpc?: (request: GrpcRequest) => Promise<GrpcResponse>;
}

export interface CaCertificate {
  enabled: boolean;
  certPaths?: string[];  // Multiple paths
  certData?: Buffer[];   // Multiple loaded certificates
}

export interface ClientCertificate {
  id: string;
  name: string;
  host: string;
  cert_path?: string;
  key_path?: string;
  passphrase_plain?: string;
  passphrase_env?: string;
  certData?: Buffer;
  keyData?: Buffer;
  enabled: boolean;
}

// Certificate settings stored in env file (YAML format)
// Note: Boolean settings (ssl_validation, allow_self_signed, enabled flags) are NOT stored in YAML
// They are stored in localStorage/workspaceState with sensible defaults
export interface EnvCertificateSettings {
  ca?: {
    paths?: string[];  // Multiple CA cert file paths
  };
  clients?: Array<{
    name?: string;
    host?: string;
    cert_path?: string;
    key_path?: string;
    passphrase_plain?: string;
    passphrase_env?: string;
  }>;
}

export interface NetworkConfig {
  ca: CaCertificate;
  clients: ClientCertificate[];
  sslValidation: boolean;
  allowSelfSigned: boolean;
  timeout: number;
  autoFormat: boolean;
}

export interface HttpRequest {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  query?: Record<string, string>;
  cookies?: Record<string, string>;
}

export interface HttpResponse {
  body: string;
  headers: Record<string, string>;
  status: number;
  statusText: string;
  duration: number;
  autoformat: boolean;
}

/** Canonical default NetworkConfig – import this instead of re-declaring. */
export const DEFAULT_NETWORK_CONFIG: NetworkConfig = {
  ca: {enabled: false},
  clients: [],
  sslValidation: true,
  allowSelfSigned: false,
  timeout: 30000,
  autoFormat: false,
};

/**
 * Boolean toggle settings for certificates, stored separately from the
 * certificate file paths (e.g. in localStorage/workspaceState).
 */
export interface CertificateSettings {
  sslValidation: boolean;
  allowSelfSigned: boolean;
  caEnabled: boolean;
  clientsEnabled: Record<string, boolean>;
}

/** Default certificate toggle settings. */
export const DEFAULT_CERT_SETTINGS: CertificateSettings = {
  sslValidation: true,
  allowSelfSigned: false,
  caEnabled: false,
  clientsEnabled: {},
};

function splitCertificateHostPattern(pattern: string): {
  hostPattern: string;
  portPattern?: string;
} {
  const trimmedPattern = pattern.trim();
  if (!trimmedPattern) {
    return {hostPattern: ''};
  }
  if (trimmedPattern.startsWith('[')) {
    const portSepIndex = trimmedPattern.lastIndexOf(']:');
    if (portSepIndex >= 0) {
      return {
        hostPattern: trimmedPattern.slice(1, portSepIndex),
        portPattern: trimmedPattern.slice(portSepIndex + 2),
      };
    }
    if (trimmedPattern.endsWith(']')) {
      return {hostPattern: trimmedPattern.slice(1, -1)};
    }
  }

  const colonCount = (trimmedPattern.match(/:/g) || []).length;
  if (colonCount === 1) {
    const sepIndex = trimmedPattern.lastIndexOf(':');
    return {
      hostPattern: trimmedPattern.slice(0, sepIndex),
      portPattern: trimmedPattern.slice(sepIndex + 1),
    };
  }

  return {hostPattern: trimmedPattern};
}

function hostPatternToRegex(hostPattern: string): RegExp {
  const escapedPattern = hostPattern
      .replace(/[|\\{}()[\]^$+?.]/g, '\\$&')
      .replace(/\*/g, '.*');
  return new RegExp(`^${escapedPattern}$`, 'i');
}

export function getDefaultPortForProtocol(protocol?: string): string|undefined {
  switch ((protocol || '').toLowerCase()) {
    case 'https:':
    case 'wss:':
    case 'grpcs:':
      return '443';
    case 'http:':
    case 'ws:':
    case 'grpc:':
      return '80';
    default:
      return undefined;
  }
}

export function matchesCertificateHost(
    certificateHostPattern: string,
    hostname: string,
    port?: string,
    protocol?: string): boolean {
  const normalizedHostname = hostname.trim().toLowerCase();
  if (!certificateHostPattern || !normalizedHostname) {
    return false;
  }

  const {hostPattern, portPattern} = splitCertificateHostPattern(
      certificateHostPattern.toLowerCase());
  if (!hostPattern) {
    return false;
  }

  const resolvedPort = (port || getDefaultPortForProtocol(protocol) || '').trim();
  if (portPattern) {
    if (!resolvedPort) {
      return false;
    }
    if (portPattern !== '*' && portPattern !== resolvedPort) {
      return false;
    }
  }

  if (hostPattern === '*') {
    return true;
  }
  if (hostPattern.includes('*')) {
    return hostPatternToRegex(hostPattern).test(normalizedHostname);
  }

  return normalizedHostname === hostPattern ||
      normalizedHostname.endsWith(`.${hostPattern}`);
}

export function findMatchingClientCertificate(
    clients: ClientCertificate[],
    hostname: string,
    port?: string,
    protocol?: string): ClientCertificate|undefined {
  return clients.find(
      cert => cert.enabled &&
          matchesCertificateHost(cert.host, hostname, port, protocol));
}

/**
 * Resolve a passphrase from a plain-text value, an environment variable name,
 * or a combination of env-var maps.
 *
 * @param passphrasePlain  Literal passphrase (highest priority).
 * @param passphraseEnv    Name of an env var that holds the passphrase.
 * @param envVars          Application-level env vars (from .mmt env file, CLI flags, etc.).
 * @param processEnv       System environment (pass `process.env` on Node; omit in other runtimes).
 */
export function resolvePassphrase(
    passphrasePlain?: string, passphraseEnv?: string,
    envVars?: Record<string, any>,
    processEnv?: Record<string, string | undefined>): string|undefined {
  if (passphrasePlain) {
    return passphrasePlain;
  }
  if (passphraseEnv) {
    if (envVars && passphraseEnv in envVars) {
      return String(envVars[passphraseEnv]);
    }
    if (processEnv && processEnv[passphraseEnv]) {
      return processEnv[passphraseEnv];
    }
  }
  return undefined;
}