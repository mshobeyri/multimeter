# API

Write request definitions in `.mmt` files with `type: api`. Open an API file in VS Code to get the **API tester** on the right (YAML stays on the left).

![API tester — method, URL, Edit API, and Body tab](../../screenshots/api-tester.png)

## YAML editor

Run glyphs appear in the left margin of the YAML pane:

| Control | What it does |
|---|---|
| {{btn:run}} on `type:` | Run the API with default inputs through core (opens log output) |
| {{btn:run}} on a named example's `name:` line | Run that example through core (opens log output) |

Example run glyphs appear only when the example has a non-empty `name`.

## API tester UI

### Top bar

| Control | What it does |
|---|---|
| **Method / protocol** | Colored dropdown left of the URL (e.g. {{btn:method:POST}}). Pick an HTTP method, or switch protocol to WebSocket / GraphQL / gRPC |
| **URL** | Editable request URL. Edits in the Params tab stay synced with the query string |
| {{btn:edit:Edit API}} | Switches to **edit mode** — see [Edit API](./edit.md) |

### Tabs

Under the URL bar:

| Tab | What you see |
|---|---|
| **In / Out** | **Example** dropdown (**Defaults** or a named example), runtime **inputs** (range pickers from description annotations), and extracted **outputs** after a send |
| **Body** | Request body; after send, **Response Body** appears below Send |
| **Params** | Query parameters |
| **Headers** | Request headers; response headers appear below Send after a reply |
| **Cookies** | Request cookies; response cookies appear below Send after a reply |
| **Doc** | Preview of `description` and `<<i:>>` / `<<o:>>` parameter docs |
| **GraphQL** / **gRPC** | Only when that protocol is selected (Body / Params / Cookies are hidden then) |

### Send

Below the request editors:

| Control | What it does |
|---|---|
| {{btn:send:Send}} | Circular send button — runs the current request (HTTP / GraphQL / gRPC). After ~1.5s while in flight it turns into **Cancel** |
| Right-click Send | Context menu: **Run in Core**, and **Run in Curl** for HTTP ([Curl](../../integration/curl.md)) |
| {{btn:plug:Connect}} | WebSocket only — connect first; Send stays disabled until connected |

### Bottom toolbar

Fixed bar at the bottom of the tester:

| Control | What it does |
|---|---|
| **Duration** | Last response time |
| **Status** | HTTP status or protocol error / warning |
| {{btn:history}} | Opens the **History** panel |
| {{btn:sparkle-filled}} | Toggle auto-format (beautify) for bodies |

Tester edits (method, URL, body, …) are temporary until you write them back to YAML. A sync warning can offer **Update YAML** / **Reset** when the editor and tester diverge.

## Supported

- Protocols: [HTTP](./protocols/http.md), [WebSocket](./protocols/websocket.md), [GraphQL](./protocols/graphql.md), [gRPC](./protocols/grpc.md)
- Formats: `json`, `xml`, `xmle`, `text`, `urlencoded`, `binary`
- Methods: `get`, `post`, `put`, `delete`, `patch`, `head`, `options`, `trace`

## Request

- `protocol:` `http` or `ws` (optional — inferred from URL if not specified)
  - URLs starting with `ws://` or `wss://` default to `ws`
  - All other URLs default to `http`
- `url:` server URL
- `method:` HTTP method `get`, `post`, `put`, `delete`, `patch`, `head`, `options`, `trace`
- `timeout:` per-request timeout in milliseconds (optional; overrides the default network timeout)
- `headers:` HTTP headers
- `query:` query parameters for HTTP requests
- `cookies:` HTTP cookies

`body` and `format`: [Body](./body/index.md) — [format](./body/format.md), [request body](./body/body.md), [HTTP body examples](./protocols/http-bodies.md).

Sample:

```yaml
protocol: http
url: x.com/blog
method: get
timeout: 5000
headers:
  Authorization: Bearer <<e:token>>
  Accept: application/json
query:
  limit: "20"
  page: "1"
  # will be converted to x.com/blog?limit=20&page=1
cookies:
  session: e:session_id
```

## API elements

- [Quick start](./quick-start.md) · [Edit API](./edit.md)
- [Protocols](./protocols/index.md) — HTTP, WebSocket, GraphQL, gRPC
- [Body](./body/index.md) — [format](./body/format.md), [request body](./body/body.md), [HTTP examples](./protocols/http-bodies.md)
- [Headers](./headers.md) · [Auth](./auth.md)
- [Inputs](./inputs.md) · [Outputs](./outputs.md)
- [Documentation](./documentation.md) — `title`, `tags`, `description`, `<<i:>>` / `<<o:>>` annotations
- [setenv](./setenv.md) · [Examples](./examples.md) · [Dynamic values](../../features/dynamic-values.md)
- [Complete examples](./complete-examples.md) · [CLI](./cli.md) · [Reference](./reference.md)
