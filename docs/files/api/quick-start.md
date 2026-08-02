# API quick start

Minimal HTTP GET against the public test server:

```yaml
type: api
title: Get sample JSON
url: https://test.mmt.dev/json
method: get
format: json
```

- `format` encodes/decodes the body (default `json`) — see [Format](./body/format.md)
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

More: [Body](./body/index.md) · [HTTP](./protocols/http.md) · [HTTP bodies](./protocols/http-bodies.md) · [WebSocket](./protocols/websocket.md) · [GraphQL](./protocols/graphql.md) · [gRPC](./protocols/grpc.md)
