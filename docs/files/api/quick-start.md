# API quick start

Minimal HTTP GET against the public test `server:`

```yaml
type: api
title: Get sample JSON
url: https://test.mmt.dev/json
method: get
format: json
```

Open the file in VS Code and click {{btn:send:Send}}. The Response panel shows status, headers, and body.

- `format` encodes/decodes the body (default `json`) — see [Format](./body/format.md)
- Protocol is inferred from the URL (`ws://` → WebSocket, otherwise HTTP)

For POST with a JSON body, add `body`:

```yaml
type: api
title: Echo JSON
url: https://test.mmt.dev/echo
method: post
format: json
body:
  message: hello world
```

The echo server returns your payload in the response — useful for checking what was sent.

More: [Body](./body/index.md) · [HTTP](./protocols/http.md) · [HTTP bodies](./protocols/http-bodies.md) · [WebSocket](./protocols/websocket.md) · [GraphQL](./protocols/graphql.md) · [gRPC](./protocols/grpc.md)
