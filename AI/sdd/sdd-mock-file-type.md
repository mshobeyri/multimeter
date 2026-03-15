# SDD: Mock Server File Type (`type: mock`)

**Date:** 2026-03-03
**Status:** Draft — awaiting refinement

---

## Summary

Add a new `.mmt` file type `type: mock` that defines a local mock server declaratively in YAML. The server runs from the VS Code editor (with a dedicated UI panel) and optionally from the CLI via `testlight`. It replaces the current basic mock server side panel with a file-driven, multi-endpoint, route-matching mock that supports dynamic tokens, history logging, and the full `.mmt` token system (`e:`, `r:`, `c:`, `<<e:>>`, etc.).

---

## Motivation

The existing mock server panel is a single-response, single-status-code server with no route awareness. Users who need endpoint-specific responses, conditional matching, or realistic mocking must use external tools (Postman mock, WireMock, etc.). A file-driven mock server:

- Lives in the project alongside APIs and tests (version-controlled, shareable)
- Uses the same token system as the rest of `.mmt` (no new syntax)
- Can be started from the editor UI or CLI
- Logs traffic to the history panel for inspection
- Replaces the need for external mock tools in most cases

### Competitive positioning

| Feature | Postman Mock | WireMock | **Multimeter Mock** |
|---|---|---|---|
| Local server | ❌ (cloud) | ✅ | ✅ |
| Declarative file | ❌ | ✅ (JSON) | ✅ (YAML) |
| IDE integration | ❌ | ❌ | ✅ (VS Code editor + UI) |
| Dynamic values | ✅ | ✅ | ✅ (reuses `r:`, `c:`, `e:`) |
| Match by body/headers/query | ✅ | ✅ | ✅ |
| CLI support | ❌ | ✅ | ✅ (`testlight mock`) |
| Request history | ✅ (cloud) | ✅ (logs) | ✅ (history panel) |
| Same ecosystem as tests | ❌ | ❌ | ✅ |

---

## YAML Schema

### Full example

```yaml
type: mock
title: User Service Mock
description: |
  Local mock for the user service API.
  Supports auth and user CRUD endpoints.
tags:
  - auth
  - users

# Server config
protocol: http          # http | https | ws
port: 8081

# Optional: TLS config (for protocol: https)
tls:
  cert: ./certs/server.crt
  key: ./certs/server.key
  ca: ./certs/ca.crt            # optional client CA for mTLS
  requestCert: false

# Global settings
cors: true                       # add CORS headers to all responses
delay: 0                         # global response delay in ms

# Global response headers (added to every endpoint response)
headers:
  X-Powered-By: Multimeter Mock

# Endpoints — first match wins (order matters for conditional matching)
endpoints:
  - method: get
    path: /users
    status: 200
    format: json
    body:
      - id: 1
        name: Mehrdad
        email: e:ADMIN_EMAIL
      - id: 2
        name: Ali
        email: ali@example.com

  - method: get
    path: /users/:id
    status: 200
    format: json
    body:
      id: ":id"
      name: Mehrdad
      created: c:epoch

  - method: post
    path: /login
    name: admin-login
    match:
      body:
        username: admin
      headers:
        X-Api-Key: "secret"
    status: 200
    format: json
    body:
      token: r:uuid
      role: admin

  - method: post
    path: /login
    name: normal-login
    status: 200
    format: json
    body:
      token: r:uuid
      expiresIn: 3600

  - method: delete
    path: /users/:id
    status: 204

  - method: get
    path: /health
    status: 200
    format: text
    body: "OK"

  - method: get
    path: /error
    status: 500
    delay: 2000
    format: json
    body:
      error: Internal Server Error
      traceId: r:uuid

  - method: post
    path: /echo
    reflect: true

# Proxy unmatched requests to a real server
proxy: <<e:REAL_API_URL>>

# Fallback for unmatched routes (when no proxy)
fallback:
  status: 404
  format: json
  body:
    error: Not Found
    path: ":path"
```

### Field reference

#### Top-level fields

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `type` | `"mock"` | yes | — | File type identifier |
| `title` | string | no | — | Display name in UI |
| `description` | string | no | — | Markdown-supported description |
| `tags` | string[] | no | — | Tags for organization |
| `protocol` | `"http"` \| `"https"` \| `"ws"` | no | `"http"` | Server protocol |
| `port` | number | yes | — | Port to listen on (1–65535) |
| `tls` | object | no | — | TLS config (required when `protocol: https`) |
| `cors` | boolean | no | `false` | Add CORS headers to all responses |
| `delay` | number | no | `0` | Global response delay in ms |
| `headers` | record | no | — | Global response headers added to all endpoints |
| `endpoints` | array | yes | — | Endpoint definitions (first match wins) |
| `proxy` | string | no | — | Forward unmatched requests to this URL |
| `fallback` | object | no | `{status: 404}` | Response for unmatched routes (ignored when `proxy` is set) |

#### `tls` fields

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `cert` | string | yes | — | Path to server certificate (relative or absolute) |
| `key` | string | yes | — | Path to server private key |
| `ca` | string | no | — | Client CA certificate (for mTLS) |
| `requestCert` | boolean | no | `false` | Require client certificate |

#### Endpoint fields

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `method` | HTTP method | yes (HTTP) | — | `get`, `post`, `put`, `delete`, `patch`, `head`, `options` |
| `path` | string | yes | — | URL path pattern. Supports `:param` path parameters |
| `name` | string | no | — | Named endpoint for selection via `x-mock-example` header |
| `match` | object | no | — | Conditional matching (see below) |
| `status` | number | no | `200` | HTTP response status code |
| `format` | `"json"` \| `"xml"` \| `"text"` | no | auto-detect | Response format (sets Content-Type) |
| `headers` | record | no | — | Per-endpoint response headers (merged with global) |
| `body` | any | no | — | Response body. Supports `r:`, `c:`, `e:`, `<<...>>` tokens |
| `delay` | number | no | inherited | Per-endpoint delay override (ms) |
| `reflect` | boolean | no | `false` | Echo the request back as the response |

#### `match` fields

| Field | Type | Description |
|---|---|---|
| `body` | object | Match when request body contains these key-value pairs (partial match) |
| `headers` | record | Match when request headers contain these values (case-insensitive keys) |
| `query` | record | Match when query parameters contain these values |

#### Format auto-detection (when `format` is omitted)

- Object or array body → `json` (Content-Type: `application/json`)
- String starting with `<` → `xml` (Content-Type: `application/xml`)
- Other string → `text` (Content-Type: `text/plain`)

### Token system

Responses support the full `.mmt` token system, resolved at request time:

| Token | Example | Description |
|---|---|---|
| `r:<name>` | `r:uuid`, `r:int`, `r:email` | Random value (new per request) |
| `c:<name>` | `c:epoch`, `c:date`, `c:time` | Current timestamp/date |
| `e:<NAME>` | `e:API_KEY` | Environment variable |
| `<<r:...>>` | `id-<<r:uuid>>` | Inline random in string |
| `<<c:...>>` | `<<c:date>> <<c:time>>` | Inline current in string |
| `<<e:...>>` | `<<e:BASE>>/path` | Inline env var in string |

Tokens in `body`, `headers`, `path`, `proxy`, and `fallback.body` are all resolved.

### Path parameters

Express-style `:param` in path patterns are captured and available in the response body:
- `path: /users/:id` matches `/users/42` and sets `:id` = `"42"`
- Use `":param"` in body values to echo path params: `body: { id: ":id" }`
- Special param `:path` in fallback body echoes the unmatched path

### Named endpoints & client-driven selection

When an endpoint has a `name`, the client can request it specifically:
```
GET /users
x-mock-example: empty-list
```
If the header matches an endpoint `name` for that method+path, that endpoint is used regardless of `match` rules. Without the header, normal first-match rules apply.

### WebSocket endpoints (protocol: ws)

When `protocol: ws`, endpoint shape differs slightly:

```yaml
type: mock
protocol: ws
port: 8082

endpoints:
  - path: /ws
    reflect: true                # echo frames back

  - path: /notifications
    format: json
    body:                        # sent to client on connection
      event: connected
      id: r:uuid
    messages:                    # respond to specific incoming messages
      - match:
          type: ping
        body:
          type: pong
          time: c:epoch
```

WebSocket endpoint fields:

| Field | Type | Description |
|---|---|---|
| `path` | string | WebSocket path |
| `reflect` | boolean | Echo incoming frames back |
| `body` | any | Message sent on connection (greeting) |
| `format` | string | Format for body serialization |
| `messages` | array | Conditional responses to incoming messages |
| `messages[].match` | object | Partial match against parsed incoming message |
| `messages[].body` | any | Response body to send |
| `messages[].format` | string | Format for this response |
| `messages[].delay` | number | Delay before sending (ms) |

---

## Changes

### Phase 1: Core data model & parsing

#### 1.1 `core/src/CommonData.ts`

- Add `"mock"` to the `Type` union: `"var" | "env" | "api" | "test" | "suite" | "doc" | "csv" | "mock" | null`
- Add `"mock"` to `typeOptions` array: `{ value: "mock", label: "Mock Server" }`

#### 1.2 `core/src/MockData.ts` (new)

Define TypeScript interfaces:

```typescript
import {Format, JSONRecord, JSONValue, Method, MMTFile} from './CommonData';

export interface MockTlsConfig {
  cert: string;
  key: string;
  ca?: string;
  requestCert?: boolean;
}

export interface MockMatch {
  body?: Record<string, JSONValue>;
  headers?: Record<string, string>;
  query?: Record<string, string>;
}

export interface MockEndpoint {
  method?: Method;
  path: string;
  name?: string;
  match?: MockMatch;
  status?: number;
  format?: Format;
  headers?: Record<string, string>;
  body?: JSONValue;
  delay?: number;
  reflect?: boolean;
}

export interface MockWsMessage {
  match?: Record<string, JSONValue>;
  body?: JSONValue;
  format?: Format;
  delay?: number;
}

export interface MockWsEndpoint {
  path: string;
  reflect?: boolean;
  body?: JSONValue;
  format?: Format;
  messages?: MockWsMessage[];
}

export interface MockFallback {
  status?: number;
  format?: Format;
  headers?: Record<string, string>;
  body?: JSONValue;
}

export interface MockData extends MMTFile {
  type: 'mock';
  title?: string;
  description?: string;
  tags?: string[];
  protocol?: 'http' | 'https' | 'ws';
  port: number;
  tls?: MockTlsConfig;
  cors?: boolean;
  delay?: number;
  headers?: Record<string, string>;
  endpoints: Array<MockEndpoint | MockWsEndpoint>;
  proxy?: string;
  fallback?: MockFallback;
}
```

#### 1.3 `core/src/JSerHelper.ts`

- Add `type: mock` detection to `fileType()`:
```typescript
if (content.includes('type: mock')) {
  return 'mock';
}
```

#### 1.4 `core/src/mockParsePack.ts` (new)

Parse and validate mock YAML:

- `parseMockData(yaml: object): MockData` — validate required fields, coerce types
- `validateMockEndpoints(endpoints: any[]): MockEndpoint[]` — validate each endpoint
- `mockDataToYaml(data: MockData): string` — serialize back to YAML (for UI round-tripping)

#### 1.5 `core/src/mockServer.ts` (new)

Platform-neutral mock server logic (no `fs`, no `vscode`):

- `createMockRouter(data: MockData)` — build a request→response matcher
  - `matchEndpoint(method, path, headers, query, body): MockEndpoint | null`
  - `resolveResponse(endpoint, pathParams, requestBody): {status, headers, body}`
  - Token resolution via injected `tokenResolver` (reuses `variableReplacer`)
- `resolvePathParams(pattern: string, actualPath: string): Record<string, string> | null`
- `autoDetectFormat(body: any): Format`
- `matchCondition(match: MockMatch, request): boolean`

This module does **not** start servers — it only computes responses. Server lifecycle is in the extension and CLI.

#### 1.6 `core/src/mockServer.test.ts` (new)

Unit tests:
- Path matching with params (`/users/:id` matches `/users/42`)
- Match priority (first match wins)
- Conditional match on body/headers/query
- Named endpoint selection via `x-mock-example`
- Token resolution in response body (`r:uuid`, `c:epoch`, `e:VAR`)
- Auto-detect format
- Fallback when no endpoint matches
- Path param echoing in response
- Reflect mode returns request body

#### 1.7 `core/src/index.ts`

Export new modules: `MockData`, `mockParsePack`, `mockServer`.

### Phase 2: Extension integration

#### 2.1 `src/mmtAPI/mockRunner.ts` (new)

VS Code-side mock server lifecycle manager:

- `startMockServer(data: MockData, envVars, logger): MockServerHandle`
  - Creates `http.Server` / `https.Server` / `WebSocket.Server` based on `data.protocol`
  - For each request: calls `core/mockServer.matchEndpoint()` + `resolveResponse()`
  - Logs to history panel (reuse `persistHistory` pattern from existing `MockServerPanel`)
  - Logs to output channel via `logger`
  - Resolves `e:` tokens from current environment
  - Resolves file paths for TLS certs relative to `.mmt` file location
- `stopMockServer(handle: MockServerHandle): void`
- Supports multiple concurrent mock servers (different ports)

#### 2.2 `src/mmtAPI/mmtAPI.ts`

Add message handlers:
- `case 'startMock'`: parse document, extract env vars, call `startMockServer()`
- `case 'stopMock'`: call `stopMockServer()`
- `case 'mockStatus'`: return current running state to webview

#### 2.3 `src/mmtAPI/run.ts`

Extend `handleRunCurrentDocument` to recognize `type: mock`:
- Parse as `MockData`
- Delegate to `mockRunner.startMockServer()`
- Report back status to webview

#### 2.4 History panel integration

Incoming requests and outgoing responses are logged to the existing history system:
- Reuse `persistHistory()` from `MockServerPanel`
- Each request logs: method, URL, headers, body, timestamp
- Each response logs: status, headers, body, duration
- History panel shows mock traffic with `protocol: mock` indicator

### Phase 3: Webview UI

#### 3.1 `mmtview/src/mock/MockPanel.tsx` (new)

Main UI panel for `type: mock` files. Sections:

**Server controls (top bar)**
- Run / Stop button (green play / red stop icon)
- Server status indicator (running on port XXXX / stopped)
- Port display (from YAML, not editable in UI — edit YAML to change)

**Endpoints list (main area)**
- Card/list view of all endpoints from the YAML
- Each card shows: method badge (colored), path, status code, format, name (if any)
- Match indicators: icons showing body/headers/query match rules
- Click to expand: shows response body preview, match conditions, delay, headers
- Reflect badge on reflect endpoints

**Live traffic log (bottom section, collapsible)**
- Real-time log of incoming requests and outgoing responses
- Each entry: timestamp, method, path, status, duration
- Click to expand: full request/response headers + body
- Clear log button
- Toggle: auto-scroll on/off

**Server info bar**
- Protocol badge (HTTP/HTTPS/WS)
- CORS indicator
- Global delay indicator
- Proxy target (if set)
- Endpoint count

#### 3.2 `mmtview/src/mock/MockEndpointCard.tsx` (new)

Individual endpoint display component:
- Method badge with color coding (GET=green, POST=blue, PUT=orange, DELETE=red, etc.)
- Path with `:param` highlighting
- Status code badge
- Format badge
- Expand/collapse for body preview
- Match conditions display (when `match` is present)

#### 3.3 `mmtview/src/mock/MockTrafficLog.tsx` (new)

Live traffic log component:
- Receives traffic events via `postMessage` from extension
- Renders scrollable list of request/response pairs
- Color-coded by status (2xx=green, 4xx=yellow, 5xx=red)
- Expandable entries for full detail

#### 3.4 `mmtview/src/App.tsx`

Add mock panel routing:
```tsx
{docType === "mock" && (
  <MockPanel content={validContent} setContent={uiSetContent} />
)}
```

### Phase 4: Schema & auto-complete

#### 4.1 `mmtview/src/text/Schema.tsx`

Add `MockSchema`:

```typescript
export const MockSchema = {
    $schema: 'http://json-schema.org/draft-07/schema#',
    type: 'object',
    required: ['type', 'port', 'endpoints'],
    properties: {
        type: { type: 'string', enum: ['mock'] },
        title: { type: 'string' },
        description: { type: 'string' },
        tags: { type: 'array', items: { type: 'string' } },
        protocol: { type: 'string', enum: ['http', 'https', 'ws'] },
        port: { type: 'number', minimum: 1, maximum: 65535 },
        tls: {
            type: 'object',
            properties: {
                cert: { type: 'string' },
                key: { type: 'string' },
                ca: { type: 'string' },
                requestCert: { type: 'boolean' }
            },
            required: ['cert', 'key']
        },
        cors: { type: 'boolean' },
        delay: { type: 'number', minimum: 0 },
        headers: { type: 'object', additionalProperties: { type: 'string' } },
        endpoints: {
            type: 'array',
            items: {
                type: 'object',
                required: ['path'],
                properties: {
                    method: { type: 'string', enum: ['get','post','put','delete','patch','head','options'] },
                    path: { type: 'string' },
                    name: { type: 'string' },
                    match: {
                        type: 'object',
                        properties: {
                            body: { type: 'object' },
                            headers: { type: 'object', additionalProperties: { type: 'string' } },
                            query: { type: 'object', additionalProperties: { type: 'string' } }
                        }
                    },
                    status: { type: 'number', minimum: 100, maximum: 599 },
                    format: { type: 'string', enum: ['json', 'xml', 'text'] },
                    headers: { type: 'object', additionalProperties: { type: 'string' } },
                    body: {},
                    delay: { type: 'number', minimum: 0 },
                    reflect: { type: 'boolean' }
                }
            }
        },
        proxy: { type: 'string' },
        fallback: {
            type: 'object',
            properties: {
                status: { type: 'number' },
                format: { type: 'string', enum: ['json', 'xml', 'text'] },
                headers: { type: 'object', additionalProperties: { type: 'string' } },
                body: {}
            }
        }
    },
    additionalProperties: false
};
```

Update `GeneralSchema` type enum to include `'mock'`.

#### 4.2 `mmtview/src/text/AutoComplete.tsx`

Add auto-complete for mock files:

**Type completion:**
- Add `Mock` option to the type completion list:
  ```
  label: "Mock"
  insertText: " mock"
  detail: 'Define a mock server'
  documentation: 'Local mock server with endpoints, route matching, and dynamic responses'
  ```

**Top-level siblings (when `type: mock`):**
```
mockTopLevelSiblings = [
  'title', 'description', 'tags', 'protocol', 'port',
  'tls', 'cors', 'delay', 'headers', 'endpoints', 'proxy', 'fallback'
]
```

With documentation for each:
- `protocol`: `Server protocol: http, https, or ws`
- `port`: `Port to listen on (1-65535)`
- `endpoints`: `Array of endpoint definitions (first match wins)`
- `cors`: `Enable CORS headers on all responses`
- `delay`: `Global response delay in milliseconds`
- `proxy`: `Forward unmatched requests to this URL`
- `fallback`: `Default response for unmatched routes`

**Endpoint-level siblings (inside `endpoints:` items):**
```
mockEndpointSiblings = [
  'method', 'path', 'name', 'match', 'status',
  'format', 'headers', 'body', 'delay', 'reflect'
]
```

**Match-level siblings (inside `match:`):**
```
mockMatchSiblings = ['body', 'headers', 'query']
```

**TLS-level siblings (inside `tls:`):**
```
mockTlsSiblings = ['cert', 'key', 'ca', 'requestCert']
```

**Fallback-level siblings (inside `fallback:`):**
```
mockFallbackSiblings = ['status', 'format', 'headers', 'body']
```

#### 4.3 `mmtview/src/text/YamlEditorPanel.tsx`

- Import `MockSchema` and apply it when `docType === 'mock'`
- Wire YAML validation to show problems for mock files (red squiggles)

### Phase 5: YAML editor glyphs / run integration

#### 5.1 Run glyph in YAML editor

Add a run glyph (play button) in the YAML editor gutter for `type: mock` files, similar to API and test files. Clicking it sends `startMock` / `stopMock` messages.

#### 5.2 Document problems

Wire `mockParsePack` validation into the diagnostics system:
- Missing required fields (port, endpoints)
- Invalid port range
- Duplicate endpoint name
- `protocol: https` without `tls` section
- Endpoint missing `method` when protocol is http
- Invalid status codes

### Phase 6: CLI support

#### 6.1 `mmtcli/src/cli.ts`

Add `testlight mock` command:
```
testlight mock path/to/mock.mmt [--port PORT] [--env-file FILE] [-e KEY=VALUE]
```

- Parses the mock file
- Starts the server in the foreground
- Logs traffic to stdout
- `--port` overrides the port from YAML
- Ctrl+C stops the server
- Env vars loaded the same way as `testlight run`

### Phase 7: Documentation

#### 7.1 `docs/mock-mmt.md` (new)

User-facing documentation:
- Quick start (minimal example)
- Full reference for all fields
- Endpoint matching rules (first match wins, named endpoints, conditional matching)
- Token system in responses
- Path parameters
- WebSocket endpoints
- TLS/HTTPS setup
- Proxy mode
- CLI usage
- Integration with tests (point test APIs at mock server)
- Migration from existing mock server panel

#### 7.2 `docs/mock-server.md` (update)

Add a note pointing to `mock-mmt.md` for file-driven mocking:
> For multi-endpoint, route-aware mocking, see [Mock MMT files](./mock-mmt.md). The panel below is for quick single-response testing.

#### 7.3 `docs/mmt-overview.md` (update)

Add `type: mock` to the overview list of file types.

---

## UI Wireframe

```
┌─────────────────────────────────────────────────────────────────────┐
│ YAML Editor (left)              │  Mock Server Panel (right)        │
│                                 │                                   │
│  type: mock                     │  ┌─────────────────────────────┐  │
│  title: User Service            │  │ ▶ Run    ⬚ localhost:8081   │  │
│  port: 8081                     │  │ HTTP · CORS · 3 endpoints   │  │
│  cors: true                     │  └─────────────────────────────┘  │
│  ...                            │                                   │
│  endpoints:                     │  Endpoints                        │
│    - method: get                │  ┌─────────────────────────────┐  │
│      path: /users               │  │ GET  /users         200 json│  │
│      ...                        │  ├─────────────────────────────┤  │
│    - method: post               │  │ POST /login         200 json│  │
│      path: /login               │  │  ├ match: body.username     │  │
│      match:                     │  ├─────────────────────────────┤  │
│        body:                    │  │ POST /echo       reflect    │  │
│          username: admin        │  └─────────────────────────────┘  │
│      ...                        │                                   │
│    - method: post               │  Traffic                   [Clear]│
│      path: /echo                │  ┌─────────────────────────────┐  │
│      reflect: true              │  │ 09:14:02 GET /users    200  │  │
│                                 │  │ 09:14:05 POST /login   200  │  │
│  fallback:                      │  │ 09:14:08 GET /unknown  404  │  │
│    status: 404                  │  └─────────────────────────────┘  │
│    body:                        │                                   │
│      error: Not Found           │                                   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Endpoint matching algorithm

```
1. Parse incoming request: method, path, headers, query, body
2. If request has `x-mock-example` header:
   a. Find endpoint with matching `name` + method + path pattern
   b. If found → use it; else → continue to step 3
3. For each endpoint in order:
   a. Does method match? (skip if not)
   b. Does path pattern match? (extract :params)
   c. If endpoint has `match`:
      - Check match.body (partial deep match)
      - Check match.headers (case-insensitive key match)
      - Check match.query (exact value match)
      - All specified match fields must pass
   d. If all pass → use this endpoint
4. If no endpoint matched:
   a. If `proxy` is set → forward request to proxy URL
   b. Else if `fallback` is set → use fallback
   c. Else → 404 with empty body
```

---

## Relationship with existing mock server panel

The existing side panel (`src/panels/MockServerPanel.ts`) remains as-is for quick single-response testing. The new `type: mock` is a separate, more powerful feature. They coexist:

| | Side Panel | `type: mock` file |
|---|---|---|
| Use case | Quick, ad-hoc testing | Structured, project-level mocking |
| Config | UI controls | YAML file (version-controlled) |
| Endpoints | One (all paths → same response) | Multiple with routing |
| Persistence | Workspace state | `.mmt` file |
| Sharing | Not shareable | Committed to repo |

No changes to the existing panel are needed.

---

## Implementation order

1. **Core data model** — `MockData.ts`, `CommonData.ts` update (1.1–1.2)
2. **Core parser** — `mockParsePack.ts` (1.4)
3. **Core router** — `mockServer.ts` + tests (1.5–1.6)
4. **File type detection** — `JSerHelper.ts` update (1.3)
5. **Schema & auto-complete** — `Schema.tsx`, `AutoComplete.tsx` (4.1–4.3)
6. **Webview UI** — `MockPanel.tsx`, `MockEndpointCard.tsx`, `MockTrafficLog.tsx` (3.1–3.4)
7. **Extension runner** — `mockRunner.ts`, message handlers (2.1–2.4)
8. **Run integration** — glyphs, diagnostics (5.1–5.2)
9. **CLI** — `testlight mock` command (6.1)
10. **Documentation** — `mock-mmt.md`, updates to overview/mock-server docs (7.1–7.3)

---

## Open questions

- [ ] Should `proxy` support path rewriting (e.g., strip a prefix before forwarding)?
- [ ] Should the mock file support `import` to compose endpoints from multiple files?
- [ ] Should WebSocket `messages` support broadcasting to all connected clients vs. replying to sender?
- [ ] Should the traffic log be opt-in (e.g., `log: true`) or always-on?
- [ ] Rate limiting / max connections — needed for v1?
