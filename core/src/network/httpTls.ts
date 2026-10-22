import * as crypto from 'crypto';

import {findMatchingClientCertificate, NetworkConfig} from '../data/NetworkData';

export function getLegacyRenegotiationSecureOptions(): number|undefined {
  let secureOptions = 0;
  const constants = crypto.constants as any;
  if (typeof constants.SSL_OP_LEGACY_SERVER_CONNECT === 'number') {
    secureOptions |= constants.SSL_OP_LEGACY_SERVER_CONNECT;
  }
  if (typeof constants.SSL_OP_ALLOW_UNSAFE_LEGACY_RENEGOTIATION === 'number') {
    secureOptions |= constants.SSL_OP_ALLOW_UNSAFE_LEGACY_RENEGOTIATION;
  }
  return secureOptions || undefined;
}

export function applyTlsCompatibilityOptions(
    target: any, opts?: {forceTls12?: boolean}): void {
  // Match broad client compatibility: keep TLS versions negotiated by Node,
  // but allow legacy renegotiation and avoid reusing fragile TLS sessions.
  target.maxCachedSessions = 0;
  if (opts?.forceTls12) {
    target.maxVersion = 'TLSv1.2';
  }
  const secureOptions = getLegacyRenegotiationSecureOptions();
  if (typeof secureOptions === 'number') {
    target.secureOptions = (target.secureOptions || 0) | secureOptions;
  }
}

export function hasUsableClientCertificate(client: any): boolean {
  return !!client?.enabled &&
      (!!client.pfxData || (!!client.certData && !!client.keyData));
}

export function getUsableClientCertificates(config: NetworkConfig): any[] {
  return (config.clients || []).filter(hasUsableClientCertificate);
}

export function findUsableClientCertificateById(
    config: NetworkConfig, clientId: string): any|undefined {
  return getUsableClientCertificates(config).find(
      client => client.id === clientId);
}

export function getSingleFallbackClientCertificate(config: NetworkConfig): any|
    undefined {
  const usableClients = getUsableClientCertificates(config);
  return usableClients.length === 1 ? usableClients[0] : undefined;
}

export function getCertificateRequiredRetryClient(
    config: NetworkConfig, hostname: string, port: string|undefined,
    protocol: string|undefined): any|undefined {
  const matchingClient =
      findMatchingClientCertificate(config.clients, hostname, port, protocol);
  if (hasUsableClientCertificate(matchingClient)) {
    return matchingClient;
  }
  return getSingleFallbackClientCertificate(config);
}

export function hasMatchingUsableClientCertificate(
    config: NetworkConfig, hostname: string, port: string|undefined,
    protocol: string|undefined): boolean {
  return hasUsableClientCertificate(
      findMatchingClientCertificate(config.clients, hostname, port, protocol));
}
