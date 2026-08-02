# Protocols

Multimeter APIs support HTTP, WebSocket, GraphQL, and gRPC.

| Protocol | When to use | Docs |
|---|---|---|
| [HTTP](./http.md) | REST and general HTTP requests | Methods, formats; [bodies](./http-bodies.md) |
| [WebSocket](./websocket.md) | Live bidirectional messaging | Connect + test frames |
| [GraphQL](./graphql.md) | GraphQL over HTTP | `graphql` block |
| [gRPC](./grpc.md) | Protobuf RPC | `grpc` block |

Shared request fields (`url`, `headers`, `auth`, `inputs`/`outputs`) are documented under [API files](../index.md).
