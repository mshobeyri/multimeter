// Node HTTP send paths: axios, HTTP/2, and native HTTPS mTLS.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const axios = require('axios/dist/node/axios.cjs');
import * as http from 'http';
import * as http2 from 'http2';
import * as https from 'https';

import {normalizeHttpResponseBody} from './binaryBody';
import {resolveApiHttpMethod} from './apiMethod';
import {
  findMatchingClientCertificate,
  HttpRequest,
  HttpResponse,
  NetworkConfig,
} from '../data/NetworkData';
import {isOmitSentinel} from '../tokens/omitKeyword';
import {TestAbortError} from '../runner/testHelper';
import {isLocalMmtDevHostname} from './localTestServer';
import {attachAbortSignal, isAbortError, throwIfAborted} from './httpAbort';
import {
  createHttpAgentWithTracking,
  createHttpsAgentWithCertificates,
  dropKeepAliveSocket,
  isDeadKeepAliveError,
  markConnectionIdle,
  recordConnectionActivity,
} from './httpAgents';
import {
  formatNetworkErrorStatusText,
  formatResponseWarning,
  formatSelfSignedWarning,
  isClientCertificateRequiredHttpResponse,
  isClientCertificateRequiredTlsError,
  isSelfSignedTlsError,
  normalizeAxiosHeaders,
  toNetworkError,
} from './httpErrors';
import {
  findUsableClientCertificateById,
  getCertificateRequiredRetryClient,
  hasMatchingUsableClientCertificate,
  hasUsableClientCertificate,
  applyTlsCompatibilityOptions,
} from './httpTls';
import {sendLocalMmtDevHttp} from './localMmtDevTransport';

function createHttp2ConnectOptions(
    hostname: string, port: string|undefined, protocol: string|undefined,
    config: NetworkConfig,
    skipCertificateValidation: boolean): http2.SecureClientSessionOptions {
  const options: http2.SecureClientSessionOptions = {};
  if (protocol === 'https:') {
    options.rejectUnauthorized =
        skipCertificateValidation ? false : config.sslValidation;
    applyTlsCompatibilityOptions(options, {
      forceTls12:
          hasMatchingUsableClientCertificate(config, hostname, port, protocol),
    });
    if (config.ca.enabled && config.ca.certData) {
      options.ca = Array.isArray(config.ca.certData) ? config.ca.certData :
                                                       [config.ca.certData];
    }
    const matchingClientCert =
        findMatchingClientCertificate(config.clients, hostname, port, protocol);
    if (matchingClientCert) {
      if (matchingClientCert.pfxData) {
        options.pfx = matchingClientCert.pfxData;
      } else if (matchingClientCert.certData && matchingClientCert.keyData) {
        options.cert = matchingClientCert.certData;
        options.key = matchingClientCert.keyData;
      }
      if (matchingClientCert.passphrase_plain) {
        options.passphrase = matchingClientCert.passphrase_plain;
      }
    }
  }
  return options;
}

function normalizeHttp2RequestHeaders(headers: Record<string, string>):
    Record<string, string> {
  const blockedHeaders = new Set([
    'connection',
    'keep-alive',
    'proxy-connection',
    'transfer-encoding',
    'upgrade',
    'host',
    'http2-settings',
  ]);
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    const normalizedKey = key.toLowerCase();
    if (blockedHeaders.has(normalizedKey)) {
      continue;
    }
    normalized[normalizedKey] = String(value);
  }
  return normalized;
}

function normalizeHttp2ResponseHeaders(raw: http2.IncomingHttpHeaders):
    Record<string, string> {
  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (key.startsWith(':') || value === undefined) {
      continue;
    }
    headers[key] = Array.isArray(value) ? value.join(', ') : String(value);
  }
  return headers;
}

function buildRequestPath(
    parsedUrl: URL, query?: Record<string, string>): string {
  const urlForPath = new URL(parsedUrl.toString());
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      urlForPath.searchParams.set(key, value);
    }
  }
  return `${urlForPath.pathname}${urlForPath.search}`;
}

function sendHttp2Request(
    req: HttpRequest, config: NetworkConfig, reqHeaders: Record<string, string>,
    parsedUrl: URL, requestTimeout: number,
    skipCertificateValidation = false): Promise<HttpResponse> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const authority = `${parsedUrl.protocol}//${parsedUrl.host}`;
    const session = http2.connect(
        authority,
        createHttp2ConnectOptions(
            parsedUrl.hostname, parsedUrl.port, parsedUrl.protocol, config,
            skipCertificateValidation));
    let settled = false;
    let stream: http2.ClientHttp2Stream|undefined;
    let detachAbort = () => {};
    const settle = (fn: () => void) => {
      if (settled) {
        return;
      }
      settled = true;
      detachAbort();
      try {
        session.close();
      } catch {
        session.destroy();
      }
      fn();
    };

    const timer = setTimeout(() => {
      settle(() => {
        reject(Object.assign(new Error('HTTP/2 request timed out'), {
          code: 'TIMEOUT',
        }));
      });
    }, requestTimeout);

    detachAbort = attachAbortSignal(req.abortSignal, () => {
      clearTimeout(timer);
      try {
        stream?.close(http2.constants.NGHTTP2_CANCEL);
      } catch {
        // ignore close races
      }
      settle(() => reject(new TestAbortError()));
    });

    session.once('error', (err) => {
      clearTimeout(timer);
      settle(() => reject(err));
    });

    const headers = {
      ':method': resolveApiHttpMethod(req.method, req.body).toUpperCase(),
      ':path': buildRequestPath(parsedUrl, req.query),
      ':scheme': parsedUrl.protocol.replace(':', ''),
      ':authority': parsedUrl.host,
      ...normalizeHttp2RequestHeaders(reqHeaders),
    };
    stream = session.request(headers);
    const chunks: Buffer[] = [];
    let responseHeaders: http2.IncomingHttpHeaders = {};

    stream.once('response', (headers) => {
      responseHeaders = headers;
    });
    stream.on('data', (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    stream.once('end', () => {
      clearTimeout(timer);
      settle(() => {
        const status = Number(responseHeaders[':status'] || 0);
        const headers = normalizeHttp2ResponseHeaders(responseHeaders);
        resolve({
          body: normalizeHttpResponseBody(Buffer.concat(chunks), headers),
          headers,
          status,
          statusText: http.STATUS_CODES[status] || '',
          duration: Date.now() - start,
          autoformat: config.autoFormat,
        });
      });
    });
    stream.once('error', (err) => {
      clearTimeout(timer);
      settle(() => reject(err));
    });
    stream.setTimeout(requestTimeout, () => {
      stream?.close(http2.constants.NGHTTP2_CANCEL);
      clearTimeout(timer);
      settle(() => {
        reject(Object.assign(new Error('HTTP/2 request timed out'), {
          code: 'TIMEOUT',
        }));
      });
    });

    const body = req.body || '';
    if (body) {
      stream.end(body);
    } else {
      stream.end();
    }
  });
}

function sendNativeHttpsRequest(
    req: HttpRequest, config: NetworkConfig, reqHeaders: Record<string, string>,
    parsedUrl: URL, requestTimeout: number, clientId: string,
    skipCertificateValidation = false): Promise<HttpResponse> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const client = findUsableClientCertificateById(config, clientId);
    if (!client) {
      reject(new Error(`Client certificate ${clientId} is not available`));
      return;
    }

    const headers = {...reqHeaders};
    delete headers['Accept-Encoding'];
    delete headers['accept-encoding'];

    const requestOptions: https.RequestOptions = {
      protocol: parsedUrl.protocol,
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || undefined,
      path: buildRequestPath(parsedUrl, req.query),
      method: resolveApiHttpMethod(req.method, req.body),
      headers,
      rejectUnauthorized: skipCertificateValidation ? false :
                                                      config.sslValidation,
      timeout: requestTimeout,
    };
    applyTlsCompatibilityOptions(requestOptions, {forceTls12: true});

    if (config.ca.enabled && config.ca.certData) {
      requestOptions.ca = Array.isArray(config.ca.certData) ?
          config.ca.certData :
          [config.ca.certData];
    }
    if (client.pfxData) {
      requestOptions.pfx = client.pfxData;
    } else if (client.certData && client.keyData) {
      requestOptions.cert = client.certData;
      requestOptions.key = client.keyData;
    }
    if (client.passphrase_plain) {
      requestOptions.passphrase = client.passphrase_plain;
    }

    const nativeReq = https.request(requestOptions, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });
      res.on('end', () => {
        detachAbort();
        const headersOut: Record<string, string> = {};
        for (const [key, value] of Object.entries(res.headers)) {
          if (value !== undefined) {
            headersOut[key] =
                Array.isArray(value) ? value.join(', ') : String(value);
          }
        }
        resolve({
          body: normalizeHttpResponseBody(Buffer.concat(chunks), headersOut),
          headers: headersOut,
          status: res.statusCode || 0,
          statusText: res.statusMessage || '',
          duration: Date.now() - start,
          autoformat: config.autoFormat,
        });
      });
    });
    const detachAbort = attachAbortSignal(req.abortSignal, () => {
      nativeReq.destroy(new TestAbortError());
    });
    nativeReq.on('error', (err) => {
      detachAbort();
      reject(isAbortError(err, req.abortSignal) ? new TestAbortError() : err);
    });
    nativeReq.setTimeout(requestTimeout, () => {
      detachAbort();
      nativeReq.destroy(Object.assign(new Error('HTTPS request timed out'), {
        code: 'TIMEOUT',
      }));
    });
    if (req.body) {
      nativeReq.write(req.body);
    }
    nativeReq.end();
  });
}
export async function sendHttpRequest(
    req: HttpRequest, config: NetworkConfig): Promise<HttpResponse> {
  throwIfAborted(req.abortSignal);
  const parsedUrl = new URL(req.url);
  const hostname = parsedUrl.hostname;
  let reqHeaders = {...req.headers};
  // Remove headers opted out with bare `omit` (or deprecated `_`) or left
  // empty/null, and remember blocks by lower-cased name so defaults cannot
  // reappear. Quoted `"omit"` is a normal string and is sent as-is.
  const blocked = new Set<string>();
  for (const [k, v] of Object.entries({...reqHeaders})) {
    if (isOmitSentinel(v) || v === '_') {
      delete (reqHeaders as any)[k];
      blocked.add(k.toLowerCase());
      continue;
    }
    if (v === null || v === undefined ||
        (typeof v === 'string' && v.trim() === '')) {
      delete (reqHeaders as any)[k];
    }
  }
  const hasHeader = (name: string) =>
      Object.keys(reqHeaders).some(k => k.toLowerCase() === name.toLowerCase());
  const getHeader = (name: string) => {
    const key = Object.keys(reqHeaders)
                    .find(k => k.toLowerCase() === name.toLowerCase());
    return key ? reqHeaders[key] : undefined;
  };
  const setHeaderIfMissing = (name: string, value: string) => {
    if (blocked.has(name.toLowerCase())) {
      return;
    }
    if (hasHeader(name)) {
      return;
    }
    reqHeaders[name] = value;
  };
  if (req.cookies && Object.keys(req.cookies).length > 0) {
    reqHeaders['Cookie'] =
        Object.entries(req.cookies).map(([k, v]) => `${k}=${v}`).join('; ');
  }
  // Infer basic defaults for common HTTP headers unless blocked or already set
  setHeaderIfMissing('User-Agent', 'Multimeter');
  setHeaderIfMissing('Accept', '*/*');
  setHeaderIfMissing('Connection', 'keep-alive');
  setHeaderIfMissing('Accept-Encoding', 'gzip, deflate, br');

  // Content-Type and Content-Length: only when a body exists and not
  // blocked/overridden
  const bodyVal = req.body;
  const isBinaryBody = typeof Buffer !== 'undefined' && Buffer.isBuffer(bodyVal);
  const bodyStr = typeof bodyVal === 'string' ? bodyVal : '';
  const hasBody = isBinaryBody ?
      (bodyVal as Buffer).length > 0 :
      (typeof bodyStr === 'string' && bodyStr.length > 0);
  if (hasBody) {
    let detectedType = 'text/plain; charset=utf-8';
    if (isBinaryBody) {
      detectedType = 'application/octet-stream';
    } else {
      try {
        const trimmed = bodyStr.trim();
        if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
          JSON.parse(trimmed);
          detectedType = 'application/json; charset=utf-8';
        } else if (trimmed.startsWith('<')) {
          detectedType = 'application/xml; charset=utf-8';
        }
      } catch {
        // keep detectedType as text/plain
      }
    }
    if (!blocked.has('content-type') && !hasHeader('Content-Type')) {
      reqHeaders['Content-Type'] = detectedType;
    }
    if (!blocked.has('content-length') && !hasHeader('Content-Length')) {
      const len = isBinaryBody ?
          (bodyVal as Buffer).length :
          Buffer.byteLength(bodyStr, 'utf8');
      reqHeaders['Content-Length'] = String(len);
    }
  }
  const requestTimeout = typeof req.timeout === 'number' &&
          Number.isFinite(req.timeout) && req.timeout >= 0 ?
      req.timeout :
      config.timeout;
  // In-process test.mmt.dev twin — answered locally, never hits the network.
  if (isLocalMmtDevHostname(hostname)) {
    return sendLocalMmtDevHttp(
        req, reqHeaders, parsedUrl, requestTimeout, config);
  }
  const shouldUseHttp2 = config.httpVersion === '2';
  if (shouldUseHttp2) {
    const start = Date.now();
    const canRetrySelfSigned =
        config.sslValidation && parsedUrl.protocol === 'https:';
    try {
      return await sendHttp2Request(
          req, config, reqHeaders, parsedUrl, requestTimeout, false);
    } catch (err: any) {
      if (isAbortError(err, req.abortSignal)) {
        throw new TestAbortError();
      }
      if (canRetrySelfSigned && isSelfSignedTlsError(err)) {
        const warning = formatSelfSignedWarning(err);
        try {
          return await sendHttp2Request(
              req, config, reqHeaders, parsedUrl, requestTimeout, true);
        } catch (retryErr: any) {
          if (isAbortError(retryErr, req.abortSignal)) {
            throw new TestAbortError();
          }
          return toNetworkError(retryErr, config, Date.now() - start, warning);
        }
      }
      return toNetworkError(err, config, Date.now() - start);
    }
  }
  // Axios re-injects User-Agent / Accept / Content-Length / etc. when a header
  // is merely absent. `false` is its opt-out so `_` / omit blocks those defaults.
  // Boolean/number runtime values (e.g. `c:git_dirty` → false, `c:epoch` → number)
  // must be stringified — axios treats a header value of `false` as "do not send".
  const axiosHeaders: Record<string, string|false> = {};
  for (const [k, v] of Object.entries(reqHeaders)) {
    if (typeof v === 'boolean' || typeof v === 'number') {
      axiosHeaders[k] = String(v);
    } else {
      axiosHeaders[k] = v as string;
    }
  }
  for (const name of blocked) {
    axiosHeaders[name] = false;
  }
  const baseRequestConfig = {
    url: req.url,
    method: resolveApiHttpMethod(req.method, req.body),
    data: req.body,
    params: req.query,
    withCredentials: true,
    headers: axiosHeaders,
    timeout: requestTimeout,
    responseType: 'arraybuffer' as const,
    transformResponse: [(data: ArrayBuffer) => data],
    signal: req.abortSignal,
  };
  const executeRequest =
      (skipValidation = false, fallbackClientCertId?: string,
       opts?: {forceTls12?: boolean}) => {
        const isHttps = parsedUrl.protocol === 'https:';
        const forceTls12 = opts?.forceTls12 ||
            (isHttps &&
             hasMatchingUsableClientCertificate(
                 config, hostname, parsedUrl.port, parsedUrl.protocol));
        const httpsAgent = isHttps ?
            createHttpsAgentWithCertificates(
                hostname, parsedUrl.port, parsedUrl.protocol, config, {
                  skipCertificateValidation: skipValidation,
                  fallbackClientCertId,
                  forceTls12,
                }) :
            undefined;
        const httpAgent =
            !isHttps ? createHttpAgentWithTracking(hostname) : undefined;
        return axios.request({...baseRequestConfig, httpsAgent, httpAgent});
      };
  const start = Date.now();
  const noteKeepAliveActivity = (source: any) => {
    const socket = source?.request?.socket || source?.socket;
    if (!socket) {
      return;
    }
    recordConnectionActivity(socket);
    markConnectionIdle(socket);
  };
  const toSuccess = (response: any, warning?: string): HttpResponse => {
    noteKeepAliveActivity(response);
    const duration = Date.now() - start;
    const headers = normalizeAxiosHeaders(response.headers);
    return {
      body: normalizeHttpResponseBody(response.data, headers),
      headers,
      status: response.status,
      statusText: response.statusText,
      duration,
      autoformat: config.autoFormat,
      warning,
    };
  };
  const toError = (err: any, warning?: string): HttpResponse => {
    const duration = Date.now() - start;
    if (err?.response && Number(err.response.status) >= 400) {
      // An error response often makes the server FIN the keep-alive socket.
      // Destroy it before the next sequential call, or that call is written
      // onto the closed connection and waits until timeout.
      dropKeepAliveSocket(err);
    } else if (err?.response) {
      noteKeepAliveActivity(err.response);
    }
    if (err?.response) {
      const headers = normalizeAxiosHeaders(err.response.headers);
      return {
        body: normalizeHttpResponseBody(
            err.response.data ?? err.response.body ?? err.response.text,
            headers,
        ),
        headers,
        status: err.response.status,
        statusText: err.response.statusText,
        duration,
        autoformat: config.autoFormat,
        warning: warning || formatResponseWarning(err),
      };
    }
    return {
      body: '',
      headers: {},
      status: -1,
      statusText: formatNetworkErrorStatusText(err),
      duration,
      autoformat: config.autoFormat,
      warning,
    } as any;
  };
  const canRetrySelfSigned =
      config.sslValidation && parsedUrl.protocol === 'https:';
  const matchingClientForNative = parsedUrl.protocol === 'https:' ?
      findMatchingClientCertificate(
          config.clients, hostname, parsedUrl.port, parsedUrl.protocol) :
      undefined;
  if (matchingClientForNative &&
      hasUsableClientCertificate(matchingClientForNative)) {
    try {
      const nativeClientId = matchingClientForNative.id;
      const nativeResponse = await sendNativeHttpsRequest(
          req, config, reqHeaders, parsedUrl, requestTimeout, nativeClientId);
      return {
        ...nativeResponse,
        warning: nativeResponse.status >= 400 ?
            `Server returned response: ${nativeResponse.status} ${
                nativeResponse.statusText}` :
            nativeResponse.warning,
      };
    } catch {
      // Fall through to the Axios path for non-mTLS transport errors.
    }
  }
  try {
    const response = await executeRequest(false);
    throwIfAborted(req.abortSignal);
    return toSuccess(response);
  } catch (err: any) {
    if (isAbortError(err, req.abortSignal)) {
      throw new TestAbortError();
    }
    let responseErr = err;
    if (isDeadKeepAliveError(err)) {
      dropKeepAliveSocket(err);
      try {
        const retryResponse = await executeRequest(false);
        throwIfAborted(req.abortSignal);
        return toSuccess(retryResponse);
      } catch (retryErr: any) {
        if (isAbortError(retryErr, req.abortSignal)) {
          throw new TestAbortError();
        }
        responseErr = retryErr;
      }
    }
    if (canRetrySelfSigned && isSelfSignedTlsError(responseErr)) {
      const warning = formatSelfSignedWarning(responseErr);
      try {
        const retryResponse = await executeRequest(true);
        throwIfAborted(req.abortSignal);
        return toSuccess(retryResponse, warning);
      } catch (retryErr: any) {
        if (isAbortError(retryErr, req.abortSignal)) {
          throw new TestAbortError();
        }
        return toError(retryErr, warning);
      }
    }
    if (parsedUrl.protocol === 'https:' &&
        isClientCertificateRequiredTlsError(responseErr)) {
      const retryClient = getCertificateRequiredRetryClient(
          config, hostname, parsedUrl.port, parsedUrl.protocol);
      if (retryClient) {
        try {
          const retryResponse =
              await executeRequest(false, retryClient.id, {forceTls12: true});
          throwIfAborted(req.abortSignal);
          return toSuccess(
              retryResponse,
              `Server requested a client certificate; retried with "${
                  retryClient.name || retryClient.host ||
                  retryClient.id}" using legacy mTLS compatibility.`);
        } catch (retryErr: any) {
          if (isAbortError(retryErr, req.abortSignal)) {
            throw new TestAbortError();
          }
          return toError(retryErr);
        }
      }
    }
    if (parsedUrl.protocol === 'https:' &&
        isClientCertificateRequiredHttpResponse(responseErr)) {
      const retryClient = getCertificateRequiredRetryClient(
          config, hostname, parsedUrl.port, parsedUrl.protocol);
      if (retryClient) {
        try {
          const retryResponse = await sendNativeHttpsRequest(
              req, config, reqHeaders, parsedUrl, requestTimeout,
              retryClient.id);
          throwIfAborted(req.abortSignal);
          return {
            ...retryResponse,
            warning: `Server requested a client certificate; retried with "${
                retryClient.name || retryClient.host ||
                retryClient.id}" using native mTLS transport.`,
          };
        } catch (retryErr: any) {
          if (isAbortError(retryErr, req.abortSignal)) {
            throw new TestAbortError();
          }
          return toError(retryErr);
        }
      }
    }
    return toError(responseErr);
  }
}

