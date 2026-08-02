# API quick start

Minimal HTTP GET:

```yaml
type: api
url: <<e:api_url>>/users
method: get
format: json
headers:
  Session: e:token
query:
  limit: "10"
```

- `format` encodes/decodes the body (default `json`)
- `query` merges with any query string in `url`
- Protocol is inferred from the URL (`ws://` → WebSocket, otherwise HTTP)

Dynamic tokens work in url/headers/body/query/cookies: `r:uuid`, `c:epoch`, `e:token`. See [Dynamic values](./dynamic-values.md).

Import JSON/YAML/CSV with top-level `import:` — [Data imports](../../integration/data-imports.md).

Paste a `curl` into the API editor to convert it; the toolbar can also run HTTP via `curl`.

More protocols: [HTTP](./protocols/http.md) · [HTTP bodies](./protocols/http-bodies.md) · [WebSocket](./protocols/websocket.md) · [GraphQL](./protocols/graphql.md) · [gRPC](./protocols/grpc.md)
