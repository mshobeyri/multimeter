# Protocols

Multimeter APIs support HTTP, WebSocket, GraphQL, and gRPC.

| Protocol | When to use | Docs |
|---|---|---|
| [HTTP](./http.md) | REST and general HTTP requests | Methods; [Body](../body/index.md) and [HTTP bodies](./http-bodies.md) |
| [WebSocket](./websocket.md) | Live bidirectional messaging | Connect + test frames |
| [GraphQL](./graphql.md) | GraphQL over HTTP | `graphql` block |
| [gRPC](./grpc.md) | Protobuf RPC | `grpc` block |

Shared request fields (`url`, `method`, `query`, `headers`, `cookies`, `auth`, `inputs`/`outputs`) are on the [API overview](../index.md#request).
