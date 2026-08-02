# API

Write request definitions in `.mmt` files with `type: api`. Open an API file in VS Code to get the **API tester** on the right (YAML stays on the left).

![API tester — method, URL, Edit API, and Body tab](../../screenshots/api-tester.png)

## API tester UI

### Top bar

| Control | What it does |
|---|---|
| **Method / protocol** | Colored dropdown left of the URL (e.g. {{btn:symbol-method:POST}}). Pick an HTTP method, or switch protocol to WebSocket / GraphQL / gRPC |
| **URL** | Editable request URL. Edits in the Params tab stay synced with the query string |
| {{btn:edit:Edit API}} | Switches to **edit mode**: Overview, Interface, and Examples. Use the back control on the edit header to return to the tester |

### Tabs

Under the URL bar:

| Tab | What you see |
|---|---|
| **In / Out** | Runtime **inputs** (range pickers from description annotations) and extracted **outputs** after a send |
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
| Right-click Send | Context menu: **Run in Core**, and **Run in Curl** for HTTP |
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

## API elements

- [Quick start](./quick-start.md)
- [Request](./request.md) — url, method, body, query, cookies
- [Headers](./headers.md) · [Auth](./auth.md)
- [Inputs](./inputs.md) · [Outputs](./outputs.md) · [Advanced outputs](./outputs-advanced.md)
- [Documentation](./documentation.md) — title, tags, description, `<<i:>>` / `<<o:>>` annotations
- [setenv](./setenv.md) · [Dynamic values](./dynamic-values.md) · [Examples](./examples.md)
- [Complete examples](./complete-examples.md) · [Reference](./reference.md)
