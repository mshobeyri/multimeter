# Mock Server

Multimeter provides two ways to mock APIs:

1. **Mock Server Panel** (VS Code sidebar) — a lightweight server for quick prototyping with reflect mode and custom status codes.
2. **MMT Mock Server Files** (`type: server`) — fully-featured mock definitions in YAML with routing, matching, dynamic responses, and proxy forwarding. Open a server file in VS Code and click {{btn:edit:Edit Mock}} to edit endpoints and settings — see [Edit Mock](./edit.md).

Both approaches support HTTP, HTTPS, mTLS, and WebSocket.

`type: server` files also support JSON/YAML/CSV data imports. Use a top-level `import:` map and reference values in endpoint bodies, headers, or match rules with `${alias.path}`. See [Data Imports](../../integration/data-imports.md).

---

## Mock Server Panel

A lightweight mock server built into Multimeter to prototype and test clients without a live backend.

Use it during development to inspect requests, echo (reflect) them back, and simulate simple responses for HTTP and WebSocket.

![Mock server](../../screenshots/mock_server.png)

## What you can use it for
- Frontend/mobile prototyping before the real API is ready
- Contract checks while iterating on request/response shapes
- Offline development and demos
- Point tests or tools at a predictable local endpoint

## Supported protocols
- HTTP: receive requests on a local port and reply with a simple body/status
- HTTPS: receive secure requests on a local port; mTLS can be enabled with client certificate verification
- WebSocket: accept connections and echo frames (useful for client wiring and quick payload checks)

## Controls in the panel
- Port: the local port to listen on (e.g., 8081)
- Reflect: when enabled, the server echoes back what it receives
  - HTTP: response body includes method, path, headers, and body you sent
  - WS: incoming frames are sent back to the same client
- Status: optional response status for HTTP (for example, 200, 400, 500)
- Content type: pick a content type for the HTTP response body (json/xml/xmle/text/urlencoded)

Tip: Reflect is a great way to validate what your client actually sends -- no backend needed.

Pointing clients at the panel, request history, and limits are covered in [Using the panel](./using.md).

Next: [Edit Mock](./edit.md) · [Using](./using.md) · [TLS](./tls.md) · [Server files](./files.md) · [In tests](./in-tests.md) · [In suites](./in-suites.md)
