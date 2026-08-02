# gRPC

```yaml
 type: api
 protocol: grpc
 url: grpc://localhost:50051
 grpc:
   service: helloworld.Greeter
   method: SayHello
   message:
     name: "World"
 outputs:
   greeting: message.message
```

Notes:
- `protocol: grpc` is required — use `grpc://` or `grpcs://` URL schemes
- The `grpc` block replaces `body`, `method`, `format`, `query`, and `cookies`
- `grpc.proto` defaults to `reflect` (server reflection); set it to a `.proto` file path for file-based definitions
- `grpc.stream` supports `server`, `client`, or `bidi`; omit for unary calls
- `headers` are sent as gRPC metadata
- Outputs use `message.*` and `metadata.*` extraction roots
- `auth` maps to metadata: bearer → `authorization: Bearer <token>`, basic → `authorization: Basic <encoded>`

### grpc block

| Field     | Type   | Required | Description |
|-----------|--------|----------|-------------|
| `proto`   | string | No       | Path to `.proto` file, or `"reflect"` (default) |
| `service` | string | Yes      | Fully-qualified service name (e.g. `helloworld.Greeter`) |
| `method`  | string | Yes      | RPC method name (e.g. `SayHello`) |
| `stream`  | string | No       | `server`, `client`, or `bidi`. Omit for unary |
| `message` | object | No       | Request message as key-value pairs |

URL: `grpc://host:port` (plaintext) or `grpcs://host:port` (TLS).

```yaml
 grpc:
   proto: ./protos/greeter.proto
   service: helloworld.Greeter
   method: SayHello
 outputs:
   greeting: message.message
   requestId: metadata.x-request-id
```

`body.*` / `headers.*` also work and map to `message` / `metadata`.

### Streaming

```yaml
 grpc:
   service: chat.ChatService
   method: StreamMessages
   stream: server
   message:
     channel: general
```

For server streaming, `message` contains all collected messages as an array. Client and bidi streaming send the message object as a single frame.

See also: [HTTP](./http.md) · [Outputs](../outputs.md) · [Auth](../auth.md)
