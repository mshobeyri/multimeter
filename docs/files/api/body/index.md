# Body

Request and response payloads for HTTP and WebSocket APIs.

| Topic | What it covers |
|---|---|
| [Format](./format.md) | `format` — how bodies are encoded and decoded (`json`, `xml`, `urlencoded`, …) |
| [Request body](./body.md) | `body` — the payload you send (YAML object, raw string, or file path) |
| [HTTP bodies](../protocols/http-bodies.md) | POST examples — JSON, XML, urlencoded, binary, text |

GraphQL and gRPC replace `body` and `format` with their own blocks. See [GraphQL](../protocols/graphql.md) and [gRPC](../protocols/grpc.md).

Other request fields (`url`, `method`, `query`, …): [API overview](../index.md#request).
