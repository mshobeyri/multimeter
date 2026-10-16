import {BinaryBodyPayload, normalizeHttpResponseBody} from './binaryBody';
import {HttpResponse, NetworkConfig} from '../data/NetworkData';

export function toNetworkError(
    err: any, config: NetworkConfig, duration: number,
    warning?: string): HttpResponse {
  const extractedBody = extractBodyFromError(err);
  return {
    body: extractedBody,
    headers: {},
    status: -1,
    statusText: formatNetworkErrorStatusText(err),
    duration,
    autoformat: config.autoFormat,
    warning,
  };
}

export function extractBodyFromError(err: any): string|BinaryBodyPayload {
  if (!err) {
    return '';
  }
  try {
    // axios-style response
    if (err.response) {
      const headers = normalizeAxiosHeaders(err.response.headers || {});
      const d = err.response.data ?? err.response.body ?? err.response.text;
      if (typeof d === 'string' || d instanceof ArrayBuffer ||
          d instanceof Uint8Array) {
        return normalizeHttpResponseBody(d, headers);
      }
      try {
        return JSON.stringify(d);
      } catch {
        // fallthrough
      }
    }

    // node native request/response may be attached under request.res
    const reqRes = err.request?.res || err?.response?.request?.res ||
        err?.request?.response;
    if (reqRes) {
      if (typeof reqRes.body === 'string') {
        return reqRes.body;
      }
      if (typeof reqRes._body === 'string') {
        return reqRes._body;
      }
      // Attempt to read buffered chunks from internal readable state
      const state = (reqRes as any)._readableState;
      if (state && Array.isArray(state.buffer) && state.buffer.length > 0) {
        try {
          const bufs = state.buffer.map((b: any) => b.data).filter(Boolean);
          if (bufs.length > 0) {
            const headers: Record<string, string> = {};
            const rawHeaders = reqRes.headers || {};
            for (const [key, value] of Object.entries(rawHeaders)) {
              if (value !== undefined) {
                headers[key] = Array.isArray(value) ? value.join(', ') :
                                                      String(value);
              }
            }
            return normalizeHttpResponseBody(Buffer.concat(bufs), headers);
          }
        } catch {
          // ignore
        }
      }
    }
  } catch {
    // ignore extraction errors
  }
  return '';
}

const SELF_SIGNED_TLS_CODES = new Set([
  'SELF_SIGNED_CERT_IN_CHAIN',
  'DEPTH_ZERO_SELF_SIGNED_CERT',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
]);

const SELF_SIGNED_MESSAGE_FRAGMENTS = [
  'self signed certificate',
  'unable to verify the first certificate',
];

const CLIENT_CERTIFICATE_REQUIRED_CODES = new Set([
  'ERR_SSL_TLSV13_ALERT_CERTIFICATE_REQUIRED',
  'ERR_SSL_TLSV1_ALERT_CERTIFICATE_REQUIRED',
  'ERR_SSL_SSLV3_ALERT_CERTIFICATE_REQUIRED',
]);

const CLIENT_CERTIFICATE_REQUIRED_MESSAGE_FRAGMENTS = [
  'alert certificate required',
  'certificate_required',
  'certificate required',
  'required ssl certificate',
  'ssl certificate was sent',
  'tlsv1_alert_certificate_required',
  'tlsv13_alert_certificate_required',
];

export function normalizeAxiosHeaders(raw: Record<string, any> = {}):
    Record<string, string> {
  return Object.fromEntries(Object.entries(raw)
                                .filter(([_, v]) => v !== undefined)
                                .map(([k, v]) => [k, String(v)]));
}

export function isSelfSignedTlsError(err: any): boolean {
  if (!err || err.response) {
    return false;
  }
  const code = extractErrorCode(err);
  if (code && SELF_SIGNED_TLS_CODES.has(code)) {
    return true;
  }
  const message =
      typeof err?.message === 'string' ? err.message.toLowerCase() : '';
  if (!message) {
    return false;
  }
  return SELF_SIGNED_MESSAGE_FRAGMENTS.some(
      fragment => message.includes(fragment));
}

export function isClientCertificateRequiredTlsError(err: any): boolean {
  if (!err || err.response) {
    return false;
  }
  const code = extractErrorCode(err);
  if (code && CLIENT_CERTIFICATE_REQUIRED_CODES.has(code)) {
    return true;
  }
  const values =
      [
        err?.message,
        err?.reason,
        ...(Array.isArray(err?.opensslErrorStack) ? err.opensslErrorStack : []),
      ].filter(value => typeof value === 'string')
          .map(value => value.toLowerCase());
  return values.some(
      value => CLIENT_CERTIFICATE_REQUIRED_MESSAGE_FRAGMENTS.some(
          fragment => value.includes(fragment)));
}

export function isClientCertificateRequiredHttpResponse(err: any): boolean {
  const response = err?.response;
  if (!response) {
    return false;
  }
  const status = Number(response.status);
  if (status !== 400 && status !== 403) {
    return false;
  }
  const values =
      [
        response.statusText,
        response.data,
      ].filter(value => typeof value === 'string')
          .map(value => value.toLowerCase());
  return values.some(
      value => CLIENT_CERTIFICATE_REQUIRED_MESSAGE_FRAGMENTS.some(
          fragment => value.includes(fragment)));
}

export function formatSelfSignedWarning(err: any): string {
  const code = extractErrorCode(err);
  const message = typeof err?.message === 'string' ? err.message :
                                                     'self-signed certificate';
  return `Self-signed certificate warning: ${code ? `${code}: ` : ''}${
      message}`;
}

export function formatResponseWarning(err: any): string|undefined {
  if (!err?.response) {
    return undefined;
  }
  const status = err.response.status;
  const statusText = err.response.statusText;
  const details = [status, statusText]
                      .filter(value => value !== undefined && value !== '')
                      .join(' ');
  return details ? `Server returned response: ${details}` :
                   'Server returned an error response';
}

export function formatNetworkErrorStatusText(err: any): string {
  const parts: string[] = [];
  const code = extractErrorCode(err) || 'NETWORK_ERROR';
  parts.push(code);
  if (typeof err?.message === 'string' && err.message && err.message !== code) {
    parts.push(err.message);
  }
  if (typeof err?.reason === 'string' && err.reason &&
      !parts.includes(err.reason)) {
    parts.push(err.reason);
  }
  if (Array.isArray(err?.opensslErrorStack)) {
    for (const stackEntry of err.opensslErrorStack) {
      if (typeof stackEntry === 'string' && stackEntry &&
          !parts.includes(stackEntry)) {
        parts.push(stackEntry);
      }
    }
  }
  return parts.join(': ');
}

export function extractErrorCode(err: any): string|undefined {
  if (err && typeof err.code === 'string' && err.code) {
    return err.code;
  }
  if (err?.cause && typeof err.cause.code === 'string' && err.cause.code) {
    return err.cause.code;
  }
  if (err?.originalError && typeof err.originalError.code === 'string' &&
      err.originalError.code) {
    return err.originalError.code;
  }
  return undefined;
}
