# API quick start

Minimal HTTP GET against the public test server:

```yaml
type: api
title: Get sample JSON
url: https://test.mmt.dev/json
method: get
format: json
```

- `format` encodes/decodes the body (default `json`)
- Protocol is inferred from the URL (`ws://` → WebSocket, otherwise HTTP)

Add `query` when you need query parameters (merged with any query string in `url`):

```yaml
type: api
url: https://test.mmt.dev/json
method: get
format: json
query:
  limit: "10"
```

Dynamic tokens (`e:…`, `r:uuid`, `c:epoch`, …) are covered in [Dynamic values](./dynamic-values.md). Environments: [Environment](../env/index.md).

Paste a `curl` into the API editor to convert it; the toolbar can also run HTTP via `curl`.

More protocols: [HTTP](./protocols/http.md) · [HTTP bodies](./protocols/http-bodies.md) · [WebSocket](./protocols/websocket.md) · [GraphQL](./protocols/graphql.md) · [gRPC](./protocols/grpc.md)
