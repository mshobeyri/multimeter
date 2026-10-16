/**
 * In-process transport for https?:// / ws(s):// local.mmt.dev
 * (same endpoints as test.mmt.dev — no sockets / DNS / internet).
 */
import {EventEmitter} from 'events';
import type WebSocket from 'ws';

import {normalizeHttpResponseBody} from './binaryBody';
import {HttpRequest, HttpResponse, NetworkConfig} from '../data/NetworkData';
import {resolveApiHttpMethod} from './apiMethod';
import {isAbortError, throwIfAborted} from './httpAbort';
import {
  echoWebSocketMessage,
  handleLocalTestServerHttp,
  isLocalMmtDevHostname,
  LocalTestServerResponse,
} from './localTestServer';
import {TestAbortError} from '../runner/testHelper';

function localResponseToHttp(
    local: LocalTestServerResponse, duration: number,
    autoformat: boolean): HttpResponse {
  const headers: Record<string, any> = {};
  for (const [k, v] of Object.entries(local.headers || {})) {
    // Match axios: lowercase header names. Keep Set-Cookie arrays intact.
    const key = k.toLowerCase();
    headers[key] = v;
  }
  if (typeof local.body === 'string') {
    return {
      body: local.body,
      headers,
      status: local.status,
      statusText: local.statusText,
      duration,
      autoformat,
    };
  }
  const buf = Buffer.from(local.body);
  return {
    body: normalizeHttpResponseBody(buf, headers),
    headers,
    status: local.status,
    statusText: local.statusText,
    duration,
    autoformat,
  };
}

/**
 * Serve https?://local.mmt.dev/... in-process (same endpoints as test.mmt.dev).
 * Follows local redirects so /redirect/n behaves like axios' default follow.
 */
export async function sendLocalMmtDevHttp(
    req: HttpRequest, preparedHeaders: Record<string, string>,
    initialUrl: URL, requestTimeout: number,
    config: NetworkConfig): Promise<HttpResponse> {
  const start = Date.now();
  let url = new URL(initialUrl.toString());
  if (req.query) {
    for (const [k, v] of Object.entries(req.query)) {
      if (v === undefined || v === null) {
        continue;
      }
      url.searchParams.set(k, String(v));
    }
  }
  const bodyText = typeof req.body === 'string' ?
      req.body :
      (typeof Buffer !== 'undefined' && Buffer.isBuffer(req.body) ?
           (req.body as Buffer).toString('utf8') :
           undefined);
  const method = resolveApiHttpMethod(req.method, req.body);
  let hops = 0;
  while (hops < 21) {
    throwIfAborted(req.abortSignal);
    const elapsed = Date.now() - start;
    if (requestTimeout > 0 && elapsed >= requestTimeout) {
      return {
        body: '',
        headers: {},
        status: -1,
        statusText: 'Timeout',
        duration: elapsed,
        autoformat: config.autoFormat,
      };
    }
    let local: LocalTestServerResponse;
    try {
      local = await handleLocalTestServerHttp(
          {
            method,
            url: url.toString(),
            headers: preparedHeaders,
            bodyText,
          },
          {abortSignal: req.abortSignal});
    } catch (err: any) {
      if (isAbortError(err, req.abortSignal)) {
        throw new TestAbortError();
      }
      throw err;
    }
    const isRedirect = local.status >= 300 && local.status < 400;
    const location = Array.isArray(local.headers.Location) ?
        local.headers.Location[0] :
        (local.headers.Location || local.headers.location);
    if (isRedirect && location && hops < 20) {
      const next = new URL(String(location), url);
      if (!isLocalMmtDevHostname(next.hostname)) {
        break;
      }
      url = next;
      hops += 1;
      continue;
    }
    return localResponseToHttp(local, Date.now() - start, config.autoFormat);
  }
  return {
    body: '',
    headers: {},
    status: -1,
    statusText: 'Too many redirects',
    duration: Date.now() - start,
    autoformat: config.autoFormat,
  };
}

/** In-memory WebSocket that echoes like test.mmt.dev /ws. */
export class LocalMmtDevWebSocket extends EventEmitter {
  readyState = 0;  // CONNECTING
  send(data: WebSocket.RawData|string): void {
    const raw = typeof data === 'string' ? data : data.toString();
    const echoed = echoWebSocketMessage(raw);
    queueMicrotask(() => {
      if (this.readyState === 1) {
        this.emit('message', Buffer.from(echoed));
      }
    });
  }
  close(): void {
    if (this.readyState === 3) {
      return;
    }
    this.readyState = 3;
    queueMicrotask(() => this.emit('close'));
  }
}

export function createLocalMmtDevWebSocket(): LocalMmtDevWebSocket {
  const ws = new LocalMmtDevWebSocket();
  queueMicrotask(() => {
    ws.readyState = 1;
    ws.emit('open');
  });
  return ws;
}
