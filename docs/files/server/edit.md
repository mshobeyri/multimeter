# Edit Mock

For `type: server` mock server files opened in VS Code, the right panel has two pages:

1. **Run view** — start/stop the mock and inspect endpoints
2. **Edit Mock** — structured editor for the YAML definition

Click {{btn:edit:Edit Mock}} in the top bar to switch to edit mode. Use the back control to return to the run view.

> This documents the editor panel for `type: server` files. The separate **Mock Server Panel** in the VS Code sidebar is a lightweight prototyping tool — see [Using the panel](./using.md).

## Run view

| Control | What it does |
|---|---|
| {{btn:play:Run mock}} / **Stop mock** | Start or stop the local mock server |
| **Configuration chips** | Base URL, protocol, CORS, connection mode, delay |
| **Endpoint list** | Method, path, status, format, and tags for each endpoint |

The server icon turns green while the mock is running.

## Edit tabs

| Tab | Icon | What you edit |
|---|---|---|
| **Overview** | {{btn:search}} | Title, description, tags, and data `import` map |
| **Server** | {{btn:server-environment}} | Protocol, port, base path, CORS, delay, TLS/mTLS, proxy, fallback |
| **Endpoints** | {{btn:list-tree}} | Endpoint list — method, path, match rules, status, body, reflect mode |

### Overview

Edit metadata and top-level `import` entries for JSON/YAML/CSV data used in endpoint bodies and match rules. See [Data Imports](../../integration/data-imports.md).

### Server

Configure server-wide settings:

- `protocol` — HTTP, HTTPS, or WebSocket
- **Port** and **base path**
- **CORS**, **delay**, **connection mode** (plain, TLS, mTLS)
- **Proxy** — forward unmatched requests to a real backend
- **Fallback** — default response when no endpoint matches

See [Server files](./files.md) and [TLS](./tls.md).

### Endpoints

Add, edit, and remove endpoint blocks. Each endpoint supports method, path, name, match rules, status code, response body/format, and **reflect** mode (echo the request back). See [Server files](./files.md).

---

See also: [Mock Server overview](./index.md) · [In tests](./in-tests.md) · [In suites](./in-suites.md)
