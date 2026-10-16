/**
 * Cloudflare Worker for test.mmt.dev.
 *
 * HTTP behaviour is shared with the in-process `local.mmt.dev` server in core
 * (`core/src/network/localTestServer.ts`). WebSocket upgrade stays Workers-only
 * (WebSocketPair) and mirrors the same echo semantics.
 */

import {
  echoWebSocketMessage,
  endpointList,
  handleLocalTestServerHttp,
  PUBLIC_TEST_SERVER_HOST,
} from '../../core/src/network/localTestServer';

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.headers.get('upgrade') === 'websocket') {
      return handleWebSocket(request, url);
    }

    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      headers[key] = value;
    });

    let bodyText: string|undefined;
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      try {
        bodyText = await request.text();
      } catch {
        bodyText = undefined;
      }
    }

    // Present as the public host in echoed URLs when served from Cloudflare.
    const publicUrl = new URL(request.url);
    publicUrl.protocol = 'https:';
    publicUrl.host = PUBLIC_TEST_SERVER_HOST;

    const local = await handleLocalTestServerHttp(
        {
          method: request.method,
          url: publicUrl.toString(),
          headers,
          bodyText,
        },
        {serviceHost: PUBLIC_TEST_SERVER_HOST});

    const responseHeaders = new Headers();
    for (const [k, v] of Object.entries(local.headers)) {
      if (Array.isArray(v)) {
        for (const item of v) {
          responseHeaders.append(k, item);
        }
      } else {
        responseHeaders.set(k, v);
      }
    }

    return new Response(
        typeof local.body === 'string' ? local.body : local.body, {
          status: local.status,
          statusText: local.statusText,
          headers: responseHeaders,
        });
  },
};

function handleWebSocket(_request: Request, url: URL): Response {
  const p = url.pathname.replace(/\/+$/, '') || '/';
  if (p !== '/ws') {
    return new Response('WebSocket endpoint is /ws', {status: 404});
  }

  const pair = new WebSocketPair();
  const [client, server] = Object.values(pair);
  server.accept();
  server.addEventListener('message', (event: MessageEvent) => {
    const raw = typeof event.data === 'string' ? event.data : '';
    server.send(echoWebSocketMessage(raw));
  });

  return new Response(null, {status: 101, webSocket: client});
}

// Re-export for docs / debugging in the worker bundle.
export {endpointList};
