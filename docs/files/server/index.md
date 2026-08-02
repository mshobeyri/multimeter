# Mock Server

Use `type: server` to define mock server endpoints in YAML. Open a server file in VS Code to get the **mock runner** on the right (YAML stays on the left). Click {{btn:edit:Edit Mock}} to edit endpoints and settings — see [Edit Mock](./edit.md).

For the lightweight **Mock Server** sidebar panel (reflect mode, quick prototyping), see [Mock server panel](./panel.md).

## Mock runner UI

### Top bar

| Control | What it does |
|---|---|
| `title` | Server title from `title:` (shown with the server icon) |
| {{btn:edit:Edit Mock}} | Switches to **edit mode** — see [Edit Mock](./edit.md) |

### Run bar

| Control | What it does |
|---|---|
| {{btn:play:Run mock}} / **Stop mock** | Start or stop the local mock server |
| Server icon | Turns green while the mock is running |

### Run view

| Section | What you see |
|---|---|
| **Configuration** | Base URL, protocol, CORS, connection mode, delay |
| **Endpoints** | Method, path, status, format, and tags for each endpoint |

## Supported

- Multiple endpoints with routing, matching, and dynamic responses — see [Endpoints](./endpoints.md)
- Echo placeholders and `e:` / `r:` / `c:` tokens — see [Tokens](./tokens.md)
- HTTPS and mTLS — see [TLS](./tls.md)
- Start from tests (`run` step) — see [In tests](./in-tests.md)
- Start from suites (`servers:` or inline items) — see [In suites](./in-suites.md)
- Top-level `import:` for JSON/YAML/CSV data — see [Data Imports](../../integration/data-imports.md)

Sample:

```yaml
type: server
title: User Service Mock
protocol: http
port: 8081
cors: true
endpoints:
  - method: get
    path: /health
    status: 200
    body: OK
  - method: get
    path: /users/:id
    status: 200
    format: json
    body:
      id: "${url.id}"
      name: Test User
```

## Mock server elements

- [Quick start](./quick-start.md) · [Edit Mock](./edit.md) · [Mock server panel](./panel.md) · [CLI](./cli.md) · [Reference](./reference.md)
- [Endpoints](./endpoints.md) · [Tokens](./tokens.md) · [TLS](./tls.md)
- [In tests](./in-tests.md) · [In suites](./in-suites.md)
