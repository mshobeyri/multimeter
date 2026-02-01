import {Protocol} from './CommonData';

/**
 * Determines the protocol from a URL string.
 * - URLs starting with ws:// or wss:// return 'ws'
 * - All other URLs return 'http'
 *
 * @param url - The URL to analyze (should already have variables resolved)
 * @returns The detected protocol
 */
export function resolveProtocolFromUrl(url: string|undefined|null): Protocol {
  if (!url || typeof url !== 'string') {
    return 'http';
  }
  const trimmed = url.trim().toLowerCase();
  if (trimmed.startsWith('ws://') || trimmed.startsWith('wss://')) {
    return 'ws';
  }
  return 'http';
}

/**
 * Returns the effective protocol, using explicit value if provided,
 * otherwise inferring from the URL.
 *
 * @param explicitProtocol - The explicitly specified protocol (may be undefined)
 * @param resolvedUrl - The URL with all variables resolved
 * @returns The effective protocol to use
 */
export function getEffectiveProtocol(
    explicitProtocol: Protocol|undefined, resolvedUrl: string|undefined):
    Protocol {
  if (explicitProtocol) {
    return explicitProtocol;
  }
  return resolveProtocolFromUrl(resolvedUrl);
}
