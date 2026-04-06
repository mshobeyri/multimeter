# SDD: GraphQL and gRPC Protocol Support

**Date:** 2026-04-05
**Status:** Draft — awaiting review

---

## Summary

Add first-class GraphQL and gRPC support to Multimeter, allowing users to define, execute, test, and document GraphQL queries/mutations and gRPC unary/streaming calls using the familiar `.mmt` YAML syntax. GraphQL reuses the existing HTTP transport with a thin syntax layer; gRPC requires a new binary transport backed by `@grpc/grpc-js` with `.proto` file loading or server reflection (`proto: reflect`, the default).

---

## Motivation

GraphQL and gRPC are the two most-requested protocol gaps (items #3 and #10 in `sdd-feature-gaps.md`). Every major competitor supports at least one:

| Tool | GraphQL | gRPC |
|------|---------|------|
| **Postman** | ✅ | ✅ |
| **Insomnia** | ✅ | ✅ |
| **Karate** | ✅ | ✅ |
| **Hoppscotch** | ✅ | ❌ |
| **Bruno** | ❌ | ❌ |
| **Multimeter** | ❌ | ❌ |

### Pain points today

**GraphQL** — Users must manually set `method: post`, hardcode `Content-Type: application/json`, and wrap queries in a JSON body string. Variables, operation names, and introspection are lost. No syntax help, no schema awareness.

```yaml
# Current workaround — verbose and error-prone
type: api
url: https://api.example.com/graphql
method: post
headers:
  Content-Type: application/json
body: |
  {"query":"{ users { id name } }","variables":{}}
```

**gRPC** — Completely impossible. The HTTP transport cannot send Protocol Buffer binary frames, negotiate HTTP/2, or load `.proto` service definitions.

### After this SDD

```yaml
# GraphQL — clean, declarative
type: api
url: https://api.example.com/graphql
protocol: graphql
graphql:
  operation: |
    query GetUsers($limit: Int) {
      users(limit: $limit) { id name email }
    }
  variables:
    limit: 10
```

```yaml
# gRPC — with proto file
type: api
url: grpc://localhost:50051
protocol: grpc
grpc:
  proto: ./protos/user.proto
  service: UserService
  method: GetUser
  message:
    user_id: 123
```

```yaml
# gRPC — server reflection (proto defaults to 'reflect', can be omitted)
type: api
url: grpc://localhost:50051
protocol: grpc
grpc:
  service: UserService
  method: GetUser
  message:
    user_id: 123
```

---

## Design

### Design Rationale

The design uses a clean three-layer structure:

| Layer | Fields | Purpose |
|-------|--------|---------|
| **Root** | `url`, `auth`, `headers`, `inputs`, `outputs`, `examples` | Shared across all protocols |
| **`graphql:`** | `operation`, `variables`, `operationName` | What to send to the GraphQL server |
| **`grpc:`** | `proto`, `service`, `method`, `message`, `stream` | What to send to the gRPC server |

Key choices:

- **Each protocol block is self-contained** — all protocol-specific data (payload included) lives inside a single block. No `body` at root for gRPC, no `variables` at root for GraphQL.
- **`protocol` is explicit** — GraphQL uses normal HTTP URLs so protocol can’t be inferred from `url`. Consistent with existing `protocol: http | ws`.
- **`inputs`/`outputs` stay at root** — they’re MMT parameterization, not protocol concepts. `inputs` feeds template variables that `graphql.variables` or `grpc.message` can reference via `{{...}}`.
- **`auth`/`headers` stay at root** — they work identically across protocols (mapped to HTTP headers for GraphQL, to gRPC metadata for gRPC).
- **`graphql.operation`** not `query` — avoids `graphql.query: query GetUsers...` stutter and is accurate for mutations/subscriptions too.
- **`grpc.message`** not `body` — matches protobuf terminology; `body` is HTTP-centric.

### Inputs & Outputs Integration

MMT `inputs` and `outputs` are protocol-agnostic parameterization. They use the same template variable substitution (`<<i:name>>`, `i:name`, `${name}`) and the same extraction styles as existing HTTP APIs (`body`/`headers`/`cookies`, regex, bracket, and dot notation). Here's how they pair with each protocol block.

#### Inputs → GraphQL

Input values flow into `graphql.variables` (and `url`, `auth`, `headers`) via template substitution:

```yaml
type: api
url: https://api.example.com/graphql
protocol: graphql

inputs:
  userId:
    type: number
    default: 1
  includeEmail:
    type: boolean
    default: true

graphql:
  operation: |
    query GetUser($id: Int!, $withEmail: Boolean!) {
      user(id: $id) {
        name
        email @include(if: $withEmail)
      }
    }
  variables:
    id: <<i:userId>>
    withEmail: <<i:includeEmail>>
```

**Resolution flow:**
1. Runner receives `inputs: { userId: 42, includeEmail: false }` (from UI, CLI, or test `call`)
2. `variableReplacer.replaceAllRefs()` substitutes `<<i:userId>>` → `42`, `<<i:includeEmail>>` → `false` inside `graphql.variables`
3. Generated JS builds: `{ query: "...", variables: { id: 42, withEmail: false } }`
4. Types are preserved — numbers stay numbers, booleans stay booleans (not stringified)

#### Inputs → gRPC

Input values flow into `grpc.message` (and `url`, `auth`, `headers`) via the same substitution:

```yaml
type: api
url: grpc://localhost:50051
protocol: grpc

inputs:
  userId:
    type: number
  pageSize:
    type: number
    default: 20

grpc:
  service: UserService
  method: ListPosts
  message:
    user_id: <<i:userId>>
    pagination:
      page_size: <<i:pageSize>>
      order_by: "created_at"
```

**Resolution flow:**
1. Runner receives `inputs: { userId: 42, pageSize: 10 }`
2. `variableReplacer.replaceAllRefs()` substitutes inside `grpc.message`
3. Generated JS passes the resolved message to `sendGrpc_()`
4. Nested objects are preserved — `pagination` stays as a sub-message

#### Outputs ← GraphQL

Outputs use the same extraction roots as HTTP, in the same order: `body`, `headers`, `cookies`, `status`, `details`, `duration`. The GraphQL JSON response lands in `body`, which follows the standard GraphQL shape `{ data: ..., errors: [...] }`:

```yaml
type: api
url: https://api.example.com/graphql
protocol: graphql

inputs:
  id:
    type: number
outputs:
  userName: body.data.user.name
  postCount: body.data.user.posts.length
  firstPost: body.data.user.posts[0].title
  hasErrors: body.errors
  traceId: headers[x-trace-id]
  statusCode: status
  responseTime: duration

graphql:
  operation: |
    query GetUser($id: Int!) {
      user(id: $id) { name email posts { title } }
    }
  variables:
    id: 42
```

These outputs are then available downstream in tests:

```yaml
# In a test .mmt file
- call: getUserApi
  id: fetchUser
  inputs:
    id: 42
- assert: fetchUser.userName == "Alice"
- assert: fetchUser.postCount > 0
```

#### Outputs ← gRPC

gRPC uses protocol-native extraction roots. At the same top level where HTTP/GraphQL use `body` and `headers`, gRPC uses `message` and `metadata`. Shared roots remain `status`, `details`, and `duration`:

```yaml
type: api
url: grpc://localhost:50051
protocol: grpc

outputs:
  userName: message.name
  postCount: message.posts.length
  firstPostTitle: message.posts[0].title
  role: message.role
  requestId: metadata[x-request-id]
  statusCode: status

grpc:
  service: UserService
  method: GetUser
  message:
    user_id: 42
```

**Key difference from GraphQL:** gRPC uses `message.*` (direct protobuf fields) while GraphQL uses `body.data.*` (through the `{ data }` wrapper). The different key names make the protocol obvious at a glance.

For server-streaming responses (`grpc.stream: server`), `message` is a JSON array of all received messages:

```yaml
outputs:
  messageCount: message.length
  firstMessage: message[0].content
  allIds: message[*].id
```

#### Response Section Summary

The extraction context is a flat first-level object. The names available at that first level depend on the protocol, and their order in docs/examples should stay stable:

| Protocol | First-level extraction roots |
|----------|------------------------------|
| **HTTP** | `body`, `headers`, `cookies`, `status`, `details`, `duration` |
| **GraphQL** | `body`, `headers`, `cookies`, `status`, `details`, `duration` |
| **gRPC** | `message`, `metadata`, `status`, `details`, `duration` |

**Validation rules:**
- HTTP/GraphQL outputs: `body`, `header`/`headers`, `cookies`, `status`, `details`, `duration` are valid.
- gRPC outputs: `message`, `metadata`, `status`, `details`, `duration` are valid.
- In gRPC outputs, using HTTP-only roots such as `body`, `header`, `headers`, or `cookies` is a parse error.
- `query` is request-only, not a response extraction root. Using `query[...]` or `query.*` in `outputs` is a parse error for all protocols.
- In HTTP/GraphQL outputs, using gRPC-only roots such as `message` or `metadata` is a parse error.
- This catches copy-paste mistakes when switching between protocols.

All extraction methods work within valid roots: dot notation (`body.user.name`, `message.user.name`), bracket notation (`headers[Content-Type]`, `metadata[x-request-id]`, `cookies[sid]`), regex (`body./pattern/`, `headers./pattern/`, `cookies./pattern/`), and keywords (`status`, `details`, `duration`).

#### Examples with Inputs/Outputs

`examples` work identically to HTTP APIs — each example can provide its own `inputs` and expected `outputs`:

```yaml
type: api
url: grpc://localhost:50051
protocol: grpc

inputs:
  userId:
    type: number
outputs:
  userName: message.name

grpc:
  service: UserService
  method: GetUser
  message:
    user_id: <<i:userId>>

examples:
  - name: existing user
    inputs:
      userId: 42
    outputs:
      userName: "Alice"
  - name: admin user
    inputs:
      userId: 1
    outputs:
      userName: "Admin"
```

### Part A: GraphQL

GraphQL rides on HTTP POST. The design adds `protocol: graphql` as syntactic sugar that compiles down to a standard HTTP request while giving users a clean authoring surface and enabling future schema-aware features.

#### YAML Syntax

All GraphQL-specific fields are nested under the `graphql` key:

```yaml
type: api
title: Get Users
url: https://api.example.com/graphql
protocol: graphql
auth:
  type: bearer
  token: "{{TOKEN}}"

# Standard .mmt fields still work
inputs:
  limit:
    type: number
    default: 10
outputs:
  userCount: body.data.users.length
  firstUser: body.data.users[0].name

graphql:
  operation: |
    query GetUsers($limit: Int, $offset: Int) {
      users(limit: $limit, offset: $offset) {
        id
        name
        email
        posts { title }
      }
    }
  variables:
    limit: 10
    offset: 0
  operationName: GetUsers
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `protocol` | `"graphql"` | Yes | Enables GraphQL mode |
| `url` | `string` | Yes | GraphQL endpoint (always POST) |
| `graphql.operation` | `string` | Yes | GraphQL query, mutation, or subscription string |
| `graphql.variables` | `object` | No | Variables passed to the operation |
| `graphql.operationName` | `string` | No | Selects the named operation when `operation` contains multiple |

**Why `operation` instead of `query`?** The GraphQL spec uses "query" for both the HTTP body field *and* one of three operation types (`query`, `mutation`, `subscription`). Using `operation` avoids the stutter of `graphql.query: query GetUsers...` and is accurate for all operation types.

**Ignored fields in GraphQL mode:** `method` (always POST), `format` (always JSON), `body` (replaced by `graphql.operation`+`graphql.variables`).

#### Compilation to HTTP

At code-generation time (`JSerAPI.ts`), `protocol: graphql` compiles to:

```typescript
// Generated JS for GraphQL
const req_ = {
  url: resolvedUrl,
  protocol: 'http',  // transport is HTTP
  method: 'post',
  headers: {
    'Content-Type': 'application/json',
    ...userHeaders
  },
  body: JSON.stringify({
    query: operationString,  // graphql.operation → "query" in the JSON body per GraphQL spec
    variables: { limit: resolvedLimit },
    operationName: 'GetUsers'
  })
};
const res_ = await send_(req_);
```

This means:
- **No changes to `networkCore.ts`** — reuses `sendHttpRequest` as-is.
- **No new dependencies** — just string/JSON manipulation.
- Auth, headers, TLS certs, proxy (future) all work transparently.
- Outputs/extraction via `body.*`, `headers[...]`, `cookies[...]`, `regex`, and bracket/dot notation work on the JSON response.

#### GraphQL Subscriptions (Future — Phase 3)

GraphQL subscriptions use WebSocket (typically `graphql-ws` protocol). This can be layered on the existing WebSocket transport in a future phase by adding `subscription` as a query type that compiles to a WS connection with the `graphql-transport-ws` sub-protocol.

---

### Part B: gRPC

gRPC requires a new transport layer. Unlike GraphQL, it cannot be compiled to HTTP/1.1 requests.

#### YAML Syntax

All gRPC-specific fields are nested under the `grpc` key:

```yaml
type: api
title: Get User
url: grpc://localhost:50051
protocol: grpc

auth:
  type: bearer
  token: "{{GRPC_TOKEN}}"

inputs:
  user_id:
    type: number
outputs:
  userName: message.name
  postCount: message.posts.length

grpc:
  proto: ./protos/user.proto   # path to .proto file (resolved relative to .mmt)
  service: UserService
  method: GetUser
  message:
    user_id: 123
    include_posts: true

examples:
  - name: active user
    inputs:
      user_id: 42
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `protocol` | `"grpc"` | Yes | Enables gRPC mode |
| `url` | `string` | Yes | `grpc://host:port` or `grpcs://host:port` for TLS |
| `grpc.proto` | `string` | No | Path to `.proto` file, or `"reflect"` for server reflection. **Default: `"reflect"`** — if omitted, server reflection is used. |
| `grpc.service` | `string` | Yes | Fully qualified service name |
| `grpc.method` | `string` | Yes | RPC method name |
| `grpc.message` | `object` | No | Request message fields (JSON representation of the protobuf message) |
| `grpc.stream` | `string` | No | Streaming mode: `"server"`, `"client"`, or `"bidi"` (default: unary) |

When `grpc.proto` is a file path (e.g. `./protos/user.proto`), the proto file is loaded and used. When `grpc.proto` is `"reflect"` (or omitted), the service definition is discovered via gRPC server reflection at runtime.

**Reused fields:** `auth` (bearer token → gRPC metadata, basic → call credentials, mTLS → channel credentials from existing cert system), `headers` (mapped to gRPC metadata), `inputs`, `outputs`, `examples`.

**Ignored request fields:** `format` (always protobuf/JSON bridged), `method` (use `grpc.method`), `body` (use `grpc.message`), `query`, `cookies`.

#### gRPC Call Types

Phase 1 targets **unary** calls only. Streaming is phased:

| gRPC Type | Phase | YAML Marker | Behavior |
|-----------|-------|-------------|----------|
| Unary | 1 | (default) | Single request → single response |
| Server streaming | 2 | `grpc.stream: server` | Single request → collect all response messages into array |
| Client streaming | 3 | `grpc.stream: client` | `grpc.message` is array of messages → single response |
| Bidirectional | 3 | `grpc.stream: bidi` | `grpc.message` is array → response is array |

For server streaming (Phase 2):

```yaml
type: api
url: grpc://localhost:50051
protocol: grpc
outputs:
  messageCount: message.length
  firstMessage: message[0].content

grpc:
  proto: ./protos/feed.proto
  service: FeedService
  method: Subscribe
  stream: server
  message:
    topic: "news"
```

The response `message` is a JSON array of all streamed messages.

#### Server Reflection

gRPC server reflection (`grpc.reflection.v1` / `grpc.reflection.v1alpha`) allows clients to discover service definitions at runtime without `.proto` files. This is particularly useful for:

- **Quick exploration** — try out a gRPC server without finding/downloading proto files
- **Dynamic services** — servers whose schemas evolve independently
- **CI environments** — no need to distribute `.proto` files alongside `.mmt` tests

When `grpc.proto` is `"reflect"` (or omitted, since it's the default):

1. Connect to the server and call `ServerReflection.ServerReflectionInfo`
2. Request the `FileDescriptorProto` for the specified `service`
3. Decode the descriptor to obtain method signatures and message types
4. Build the gRPC client stub dynamically from the reflected descriptor
5. Cache the reflected descriptor per `host:port:service` for the duration of the run

```typescript
// In grpcCore.ts
async function reflectServiceDefinition(
  channel: grpc.Channel,
  serviceName: string
): Promise<protoLoader.PackageDefinition> {
  // 1. Create reflection client
  // 2. Call ServerReflectionInfo with FileContainingSymbol request
  // 3. Decode FileDescriptorProto response(s)
  // 4. Build PackageDefinition from decoded descriptors
  // Falls back to v1alpha if v1 is not available
}
```

**Precedence:** If `grpc.proto` is set to a file path, that file is used and reflection is not attempted. This allows users to pin a known schema for production while using the default reflection for development.

**Reflection limitations:**
- Requires the server to have reflection enabled (common in dev/staging, less so in production)
- Slightly slower first call due to the reflection round-trip (cached afterward)
- Cannot validate the `.mmt` body at parse time — validation happens at runtime

#### Transport Layer

A new `sendGrpcRequest` function in `core/src/networkCore.ts` (or a new `grpcCore.ts` file):

```typescript
export interface GrpcRequest {
  url: string;               // grpc://host:port
  proto: string;             // absolute path to .proto, or 'reflect' for server reflection
  service: string;
  method: string;
  metadata?: Record<string, string>;  // headers → gRPC metadata
  message?: object;            // JSON message (from grpc.message)
  stream?: 'server' | 'client' | 'bidi';
}

export interface GrpcResponse {
  body: string;              // JSON-stringified response message(s)
  metadata: Record<string, string>;  // response metadata (trailing)
  status: number;            // gRPC status code (0 = OK, mapped to HTTP-like for consistency)
  statusText: string;        // gRPC status description
  duration: number;
}
```

**Dependency:** `@grpc/grpc-js` + `@grpc/proto-loader` (both pure JS, no native compilation needed — critical for VS Code extension compatibility).

**Proto loading** uses `fileLoader` (injected) to read `.proto` files and their imports, keeping `core` platform-neutral. When `grpc.proto` is `"reflect"`, proto loading is bypassed and the service definition is obtained via server reflection instead:

```typescript
// In grpcCore.ts
async function loadServiceDefinition(
  request: GrpcRequest,
  fileLoader: (path: string) => Promise<string>,
  channel: grpc.Channel
): Promise<protoLoader.PackageDefinition> {
  if (request.proto !== 'reflect') {
    // proto is a file path — load via injected fileLoader
    return loadProtoFromFile(request.proto, fileLoader);
  }
  // Default: use server reflection to discover the service
  return reflectServiceDefinition(channel, request.service);
}
```

**Channel/connection pooling** follows the same pattern as HTTP agent pooling in `networkCore.ts` — keyed by `host:port:tls`.

#### Auth Mapping

| MMT Auth | gRPC Equivalent |
|----------|-----------------|
| `bearer` | `grpc.Metadata` with `authorization: Bearer <token>` |
| `basic` | `grpc.Metadata` with `authorization: Basic <b64>` |
| `api-key` | `grpc.Metadata` with custom key |
| `oauth2` | Token fetch via HTTP (existing), then bearer metadata |
| TLS client certs | `grpc.credentials.createSsl()` with cert/key from `NetworkConfig.clients` |

#### Response Normalization

gRPC responses are normalized to look like HTTP responses so that existing output extraction, assertions, and logging work:

| gRPC field | Maps to |
|------------|---------|
| Response message (JSON) | `message` |
| Trailing metadata | `metadata` |
| Status code 0 (OK) | `status: 200` |
| Status code 1-16 | `status: 4xx/5xx` (mapped table below) |
| Status description | `statusText` |
| Full call details | `details` |
| Elapsed time | `duration` |

**gRPC → HTTP status mapping:**

| gRPC Code | Name | HTTP Status |
|-----------|------|-------------|
| 0 | OK | 200 |
| 1 | CANCELLED | 499 |
| 2 | UNKNOWN | 500 |
| 3 | INVALID_ARGUMENT | 400 |
| 4 | DEADLINE_EXCEEDED | 504 |
| 5 | NOT_FOUND | 404 |
| 6 | ALREADY_EXISTS | 409 |
| 7 | PERMISSION_DENIED | 403 |
| 8 | RESOURCE_EXHAUSTED | 429 |
| 9 | FAILED_PRECONDITION | 400 |
| 10 | ABORTED | 409 |
| 11 | OUT_OF_RANGE | 400 |
| 12 | UNIMPLEMENTED | 501 |
| 13 | INTERNAL | 500 |
| 14 | UNAVAILABLE | 503 |
| 15 | DATA_LOSS | 500 |
| 16 | UNAUTHENTICATED | 401 |

This mapping allows `assert: status == 200` and `check: status < 300` to work identically for HTTP and gRPC.

---

## Data Model Changes

### `core/src/CommonData.ts`

```typescript
// Before
export type Protocol = "http" | "ws";
export type Format = "json" | "xml" | "text";

// After
export type Protocol = "http" | "ws" | "graphql" | "grpc";
export type Format = "json" | "xml" | "text" | "protobuf";
export type GrpcStream = "server" | "client" | "bidi";
```

### `core/src/APIData.ts`

```typescript
export interface GraphQLConfig {
  operation: string;          // GraphQL query/mutation/subscription string
  variables?: JSONRecord;     // GraphQL variables
  operationName?: string;     // Named operation selector
}

export interface GrpcConfig {
  proto?: string;             // path to .proto file, or 'reflect' (default: 'reflect')
  service: string;            // fully qualified service name
  method: string;             // RPC method name
  message?: object;           // request message (JSON representation of protobuf message)
  stream?: GrpcStream;        // streaming mode
}

export interface APIData extends MMTFile {
  // ... existing fields ...

  graphql?: GraphQLConfig;    // GraphQL-specific config (when protocol: graphql)
  grpc?: GrpcConfig;          // gRPC-specific config (when protocol: grpc)
}
```

Note: The root `method` field is ignored for gRPC — use `grpc.method` instead. The root `body` field is ignored for gRPC — use `grpc.message` instead.

### `mmtview/src/text/Schema.tsx`

The editor JSON schema must be extended alongside the core data model so YAML validation, hover help, and completion all understand the new shapes.

Required schema changes:

- Extend `APISchema.properties.protocol.enum` to include `graphql` and `grpc`.
- Add `graphql` and `grpc` object schemas under `APISchema.properties`.
- Add conditional `if/then` rules:
  - `protocol: graphql` requires `graphql.operation`.
  - `protocol: grpc` requires `grpc.service` and `grpc.method`.
- Add protocol-specific disallow/validation rules in schema so the editor flags incompatible keys early:
  - GraphQL: `body` should not be used; `graphql.operation`/`graphql.variables`/`graphql.operationName` are the valid request payload surface.
  - gRPC: `body`, `query`, and `cookies` should not be used; `grpc.message` is the valid payload surface.
- Keep root `headers`, `inputs`, `outputs`, `examples`, and `auth` valid across all protocols.

This schema layer is intentionally redundant with core parsing validation. The schema gives immediate editor feedback; `apiParsePack.ts` remains the source of truth.

### Canonical API Key Order

The canonical root order for `type: api` YAML must be updated so formatting and ordering validation stay stable when GraphQL/gRPC blocks are present:

```text
type
title
description
tags
inputs
outputs
setenv
url
query
protocol
method
format
auth
headers
cookies
body
graphql
grpc
examples
```

Nested canonical order:

- `graphql`: `operation`, `variables`, `operationName`
- `grpc`: `proto`, `service`, `method`, `stream`, `message`

### `core/src/NetworkData.ts`

```typescript
// Add GrpcRequest / GrpcResponse interfaces (see Transport Layer section above)

// Extend NetworkAPI
export interface NetworkAPI {
  // ... existing fields ...

  // gRPC
  sendGrpc?: (request: GrpcRequest) => Promise<GrpcResponse>;
}
```

---

## File-by-File Changes

### Core

| File | Change |
|------|--------|
| `core/src/CommonData.ts` | Extend `Protocol`, `Format` types; add `GrpcStream` type |
| `core/src/APIData.ts` | Add `GraphQLConfig`, `GrpcConfig` interfaces; add `graphql?`, `grpc?` to `APIData` |
| `core/src/NetworkData.ts` | Add `GrpcRequest`, `GrpcResponse` interfaces; extend `NetworkAPI` |
| `core/src/apiParsePack.ts` | Validate `graphql` block when `protocol: graphql`; validate `grpc` block when `protocol: grpc`; reject cross-protocol blocks; default `grpc.proto` to `"reflect"`; validate protocol-specific extraction roots in `outputs` |
| `core/src/JSerAPI.ts` | Generate GraphQL body compilation; generate gRPC `sendGrpc_()` calls for `protocol: grpc` |
| `core/src/grpcCore.ts` | **New file.** Proto loading, server reflection, channel management, `sendGrpcRequest()` |
| `core/src/networkCore.ts` | Minor: export shared TLS helpers for reuse by `grpcCore.ts` |
| `core/src/runApi.ts` | Extend `buildApiRunnerWrapper` to inject `sendGrpc_` global; log gRPC request/response with metadata |
| `core/src/runner.ts` | Pass `grpcSender` through to API runner when protocol is grpc |
| `core/src/outputExtractor.ts` | Extend extraction roots for gRPC (`message`, `metadata`) while keeping HTTP/GraphQL roots (`body`, `headers`, `cookies`) |

### Extension Host

| File | Change |
|------|--------|
| `src/mmtEditorProvider.ts` | Wire `grpcSender` using `core/grpcCore` with Node `fs`-based `fileLoader` for `.proto` files |
| `src/vscodeNetwork.ts` | Extend `NetworkConfig` bridging if needed |

### CLI

| File | Change |
|------|--------|
| `mmtcli/src/cli.ts` | Wire `grpcSender` with Node `fs` file loader for `.proto` resolution |

### Webview

| File | Change |
|------|--------|
| `mmtview/src/text/Schema.tsx` | Extend `APISchema` for `protocol: graphql|grpc`, add `graphql` and `grpc` object schemas, and protocol-specific YAML validation rules |
| `mmtview/src/text/validator.ts` | Extend canonical root order; validate `outputs` roots per protocol; surface invalid `body`/`headers`/`cookies` vs `message`/`metadata` usage; flag request-only `query` in outputs |
| `mmtview/src/text/YamlEditorPanel.tsx` | Surface new schema and validator problems as editor markers; show protocol-specific parse/YAML errors inline |
| `mmtview/src/text/useFormatAndOrder.ts` | Format and reorder GraphQL/gRPC documents using the new canonical order |
| `mmtview/src/text/AutoComplete.tsx` | Add protocol values (`graphql`, `grpc`), nested key suggestions (`graphql.*`, `grpc.*`), output-root suggestions by protocol, and schema-aware inner-field completions |
| `mmtview/src/api/APIInterface.tsx` | Hide HTTP-only controls (`method`, `format`, `query`, `cookies`, `body`) when protocol is `graphql`/`grpc`; add protocol-specific editors for `graphql` and `grpc` blocks |
| `mmtview/src/api/APITester.tsx` | Add protocol-specific tabs: `GraphQL` tab for `operation`/`variables`/`operationName`, `gRPC` tab for `proto`/`service`/`method`/`stream`/`message`; hide HTTP-only tabs (`Params`, `Cookies`, generic `Body`) when not applicable |
| `mmtview/src/api/APIPanel.tsx` | Persist/select the new protocol-specific tabs and ensure tab state remains valid when protocol changes |
| `mmtview/src/components/network/Network.tsx` | Keep response display compatible with normalized gRPC `message`/`metadata` while HTTP/GraphQL remain `body`/`headers`/`cookies` |

### Documentation

| File | Change |
|------|--------|
| `docs/api-mmt.md` | Add GraphQL and gRPC sections with syntax and examples |
| `docs/mmt-overview.md` | Update protocol support matrix |

### Converters (Phase 3)

| File | Change |
|------|--------|
| `core/src/graphqlConvertor.ts` | **New.** Import GraphQL schema/introspection → `.mmt` API files |
| `core/src/protoConvertor.ts` | **New.** Import `.proto` files → `.mmt` API files with stubs for each RPC |

---

## Logging

### GraphQL

Logged identically to HTTP with additional context:

```
Request:
  url: https://api.example.com/graphql
  method: POST
  protocol: graphql
  graphql.operationName: GetUsers
  graphql.operation: query GetUsers($limit: Int) { users(limit: $limit) { id name } }
  graphql.variables: { limit: 10 }

Response:
  status: 200
  duration: 87ms
  body: { data: { users: [...] } }
```

If the response contains a `errors` array (GraphQL error response), the run is marked as **failed** and errors are surfaced:

```
GraphQL Errors:
  - Cannot query field "email" on type "User" (line 3, col 5)
```

### gRPC

```
Request:
  url: grpc://localhost:50051
  protocol: grpc
  grpc.service: UserService
  grpc.method: GetUser
  metadata: { authorization: "Bearer ****..." }
  grpc.message: { user_id: 123 }

Response:
  status: 0 (OK) → 200
  duration: 12ms
  metadata: { x-request-id: "abc-123" }
  message: { id: 123, name: "Alice", posts: [...] }
```

---

## Error Handling

| Scenario | Behavior |
|----------|----------|
| GraphQL: endpoint returns `errors` array | `status` stays as HTTP status; run marked failed; errors logged |
| GraphQL: `graphql.operation` field missing | Parse-time validation error in `apiParsePack` |
| gRPC: `.proto` file not found | Parse-time error: `Proto file not found: ./protos/user.proto` |
| gRPC: reflection not supported by server (default `grpc.proto: reflect`) | Runtime error: `Server reflection not available at grpc://host:port — set "grpc.proto" to a .proto file path instead` |
| gRPC: service/method not in proto | Runtime error: `Method "GetUser" not found in service "UserService"` |
| gRPC: service not found via reflection | Runtime error: `Service "UserService" not found via server reflection` |
| gRPC: connection refused | Normalized: `status: -1`, `statusText: "Connection refused: grpc://localhost:50051"` |
| gRPC: deadline exceeded | Normalized: `status: 504`, `statusText: "DEADLINE_EXCEEDED"` |
| gRPC: proto import chain broken | Parse-time error listing the missing import |
| Wrong protocol block used | Parse-time warning: `"grpc" block is ignored for protocol: graphql` |

---

## Validation Layers

Support for GraphQL and gRPC needs validation in three separate layers. The SDD should treat all three as required, not optional polish:

### 1. Core Parse Validation

`core/src/apiParsePack.ts` remains the authoritative validator.

It must validate:

- Required protocol blocks:
  - `protocol: graphql` requires `graphql.operation`
  - `protocol: grpc` requires `grpc.service` and `grpc.method`
- Invalid field combinations:
  - GraphQL rejects `body`
  - gRPC rejects `body`, `query`, and `cookies`
- Output extraction roots by protocol:
  - HTTP/GraphQL allow `body`, `header`/`headers`, `cookies`, `status`, `details`, `duration`
  - gRPC allows `message`, `metadata`, `status`, `details`, `duration`
  - `query` is never valid in `outputs`
- Cross-protocol blocks:
  - `graphql` block with `protocol: grpc` → validation error
  - `grpc` block with `protocol: graphql` → validation error

### 2. YAML Schema Validation

`mmtview/src/text/Schema.tsx` must mirror the same rules so the editor flags invalid YAML before execution.

This layer should show schema errors for:

- missing required nested fields (`graphql.operation`, `grpc.service`, `grpc.method`)
- invalid protocol enum values
- invalid nested field types
- forbidden request fields for the selected protocol
- malformed `graphql`/`grpc` object shapes

The schema should be strict enough to guide editing, but core parse validation still decides final correctness.

### 3. UI Validation

The visual API editor should prevent invalid combinations instead of only reporting them after the fact:

- hide controls that do not apply to the current protocol
- disable protocol-incompatible tabs
- clear or warn on stale values when switching protocol
- validate required protocol fields inline before send/run

## Error Surfacing

Errors must be visible where the user edits the data.

### YAML Editor

`mmtview/src/text/YamlEditorPanel.tsx` and `mmtview/src/text/validator.ts` should surface:

- YAML schema errors as Monaco markers
- parse validation errors as Monaco markers
- ordering/format problems as warnings
- invalid output-root usage with clear messages, for example:
  - `"message" is only valid for protocol: grpc`
  - `"body" is not valid for protocol: grpc; use "message"`
  - `"query" is request-only and cannot be used in outputs`

### Visual API Editor

`mmtview/src/api/APIInterface.tsx` and `mmtview/src/api/APITester.tsx` should show protocol-specific validation messages near the affected controls:

- missing `graphql.operation`
- missing `grpc.service` / `grpc.method`
- invalid `grpc.proto` path
- unsupported server reflection / missing schema information
- invalid output extraction root for the selected protocol

Errors should appear in the relevant tab/panel, not only as a generic top-level toast.

## API Page UI Changes

The API page needs protocol-aware editing surfaces rather than reusing HTTP-only UI.

### Interface Editor

`mmtview/src/api/APIInterface.tsx` should behave as follows:

- **HTTP**: keep existing controls (`method`, `format`, `query`, `headers`, `cookies`, `body`)
- **GraphQL**:
  - keep shared controls: `url`, `auth`, `headers`, `inputs`, `outputs`, `examples`
  - hide HTTP-only controls: `method`, `query`, `cookies`, generic `body`
  - hide root `format` control from the editor because GraphQL is always JSON over HTTP
  - show GraphQL-specific controls: `graphql.operation`, `graphql.variables`, `graphql.operationName`
- **gRPC**:
  - keep shared controls: `url`, `auth`, `headers` (mapped to metadata), `inputs`, `outputs`, `examples`
  - hide HTTP-only controls: `method`, `format`, `query`, `cookies`, generic `body`
  - show gRPC-specific controls: `grpc.proto`, `grpc.service`, `grpc.method`, `grpc.stream`, `grpc.message`

### Tester Tabs

`mmtview/src/api/APITester.tsx` currently exposes HTTP-oriented tabs. It should become protocol-aware:

- **HTTP tabs**: `In / Out`, `Body`, `Params`, `Headers`, `Cookies`, `Doc`
- **GraphQL tabs**: `In / Out`, `GraphQL`, `Headers`, `Doc`
- **gRPC tabs**: `In / Out`, `gRPC`, `Headers`, `Doc`

Notes:

- The `GraphQL` tab edits `operation`, `variables`, and `operationName`.
- The `gRPC` tab edits `proto`, `service`, `method`, `stream`, and `message`.
- HTTP-only tabs must be hidden, not merely disabled, when the selected protocol is GraphQL or gRPC.
- The response side should still show shared output concepts, but label them by protocol where needed (`Response Body` for HTTP/GraphQL, `Response Message` and `Metadata` for gRPC).

## Formatting

Formatting is part of the feature, because users will edit nested GraphQL/gRPC blocks frequently.

### YAML Formatting / Ordering

`mmtview/src/text/useFormatAndOrder.ts` and `apiToYaml()` / `yamlToAPI()` must:

- preserve the canonical root order including `graphql` and `grpc`
- preserve nested canonical order inside `graphql` and `grpc`
- keep protocol-specific blocks grouped rather than flattening them
- normalize stale protocol fields when a document is reformatted after a protocol switch

### Value Formatting

The visual editor should also format protocol payloads correctly:

- GraphQL `operation` should preserve multi-line block formatting and indentation
- GraphQL `variables` should be formatted as JSON/YAML object content
- gRPC `message` should be formatted as structured JSON/YAML object content
- gRPC `metadata` display in responses should be pretty-printed consistently with HTTP headers

## Autocomplete

Autocomplete needs both structural suggestions and protocol-aware inner-field suggestions.

### Structural Autocomplete

`mmtview/src/text/AutoComplete.tsx` should add:

- root protocol values: `graphql`, `grpc`
- nested keys:
  - `graphql.operation`
  - `graphql.variables`
  - `graphql.operationName`
  - `grpc.proto`
  - `grpc.service`
  - `grpc.method`
  - `grpc.stream`
  - `grpc.message`
- output extraction roots by protocol:
  - HTTP/GraphQL: `body`, `header`, `headers`, `cookies`, `status`, `details`, `duration`
  - gRPC: `message`, `metadata`, `status`, `details`, `duration`

### Inner-Item Autocomplete

When schema information is available, autocomplete should go beyond just the first-level keys:

- **GraphQL**:
  - suggest operation templates (`query`, `mutation`, `subscription`)
  - suggest `operationName`
  - suggest fields under `graphql.variables` and response output paths from introspection data when available
- **gRPC**:
  - suggest services and methods from `.proto` files or reflection
  - suggest message field names under `grpc.message`
  - suggest nested output paths under `message.*` when a response schema is available

Fallback behavior when schema data is unavailable:

- still provide structural key suggestions
- do not block editing
- show a soft warning that schema-aware completion is unavailable until `.proto` or reflection / GraphQL schema metadata is available

---

## Implementation Plan

### Phase 1 — GraphQL (Low effort, high impact)

**Effort:** Small — no new dependencies, no new transport.

1. Extend `Protocol` type to include `"graphql"`
2. Add `GraphQLConfig` interface and `graphql?` field to `APIData`
3. Update `apiParsePack.ts` validation: require `graphql.operation` when `protocol: graphql`; reject invalid request/output fields for GraphQL
4. Update `JSerAPI.ts` code generation: compile `graphql` block to HTTP POST JSON body (`{ query: graphql.operation, variables: graphql.variables, operationName: graphql.operationName }`)
5. Update logging in `runApi.ts`: show `graphql.operation`, `graphql.variables`, `graphql.operationName` in request log
6. Detect GraphQL error responses (`errors` array) and mark run as failed
7. Extend `mmtview/src/text/Schema.tsx`, `validator.ts`, and `AutoComplete.tsx` for GraphQL YAML validation and completion
8. Update `APIInterface.tsx` and `APITester.tsx` to expose the GraphQL-specific editing tab and hide HTTP-only controls
9. Update formatting/order logic for `graphql` block
10. Add docs section to `api-mmt.md`
11. Add unit/UI tests for parse, codegen, YAML validation, formatting, and error detection

### Phase 2 — gRPC Unary + Reflection (Medium effort, high impact)

**Effort:** Medium — new dependency (`@grpc/grpc-js`, `@grpc/proto-loader`), new transport module.

1. Add `@grpc/grpc-js` and `@grpc/proto-loader` to `core/package.json`
2. Create `core/src/grpcCore.ts`: proto loading (via injected `fileLoader`), channel pool, `sendGrpcRequest`
3. Implement server reflection client in `grpcCore.ts`: `reflectServiceDefinition()` supporting `grpc.reflection.v1` with fallback to `v1alpha`
4. Extend `Protocol` to include `"grpc"`; add `GrpcConfig` interface and `grpc?` field to `APIData`
5. Update `apiParsePack.ts`: validate `grpc` block fields; default `grpc.proto` to `"reflect"` when omitted; reject invalid request/output fields for gRPC
6. Update `JSerAPI.ts`: generate `sendGrpc_()` calls for gRPC APIs
7. Update `runApi.ts`: inject `sendGrpc_` global, log gRPC requests/responses
8. Wire in extension host (`mmtEditorProvider.ts`) and CLI (`cli.ts`)
9. gRPC → HTTP status code mapping
10. Auth mapping (bearer/basic → metadata, client certs → channel credentials)
11. Extend `mmtview/src/text/Schema.tsx`, `validator.ts`, and `AutoComplete.tsx` for gRPC YAML validation and completion
12. Update `APIInterface.tsx` and `APITester.tsx` to expose the gRPC-specific editing tab and hide HTTP-only controls
13. Update formatting/order logic for `grpc` block
14. Docs and unit/UI tests (including reflection-specific tests)

### Phase 3 — Advanced Features (Future)

1. **gRPC streaming** — server, client, and bidirectional streaming
2. **GraphQL subscriptions** — WebSocket-based subscriptions via `graphql-ws`
3. **Proto converter** — `.proto` → `.mmt` API stubs
4. **GraphQL introspection converter** — schema → `.mmt` API stubs
5. **gRPC reflection-based service browser** — list all services/methods from a reflected server in a side panel
6. **GraphQL schema validation** — validate queries against introspected schema at parse time

---

## Testing Strategy

### Unit Tests (`core/src/`)

| Test | Covers |
|------|--------|
| `graphqlParse.test.ts` | Parse `protocol: graphql` YAML with `graphql` block, validate required `operation` field, reject invalid combos |
| `graphqlCodegen.test.ts` | Generated JS produces correct HTTP POST body (`{ query, variables, operationName }`) from `graphql` block |
| `graphqlError.test.ts` | GraphQL error response detection and failure marking |
| `grpcParse.test.ts` | Parse `protocol: grpc` YAML with `grpc` block, validate service/method fields, default proto to reflect |
| `grpcCore.test.ts` | Proto loading, server reflection, channel creation, status code mapping |
| `grpcCodegen.test.ts` | Generated JS calls `sendGrpc_` with correct request shape |
| `mmtview/src/text/validator.test.ts` | Protocol-aware YAML validation, output-root validation, and canonical order warnings for `graphql` / `grpc` |
| `mmtview/src/text/importAutocomplete.test.ts` / new autocomplete tests | Protocol-specific suggestions for `graphql.*`, `grpc.*`, `message`, `metadata`, and invalid output-root suppression |
| `mmtview/src/components/network/Network.protocol.test.ts` | Response normalization for GraphQL and gRPC request/response display |

### UI / Editor Tests

- `mmtview/src/api/APIInterface.test.tsx`: protocol switch hides HTTP-only controls and shows GraphQL/gRPC editors
- `mmtview/src/api/APITester.test.tsx`: tab sets change by protocol (`GraphQL` / `gRPC` tabs appear; HTTP-only tabs disappear)
- `mmtview/src/text/Schema.test.ts` or equivalent: schema-level validation catches missing `graphql.operation`, missing `grpc.service`, invalid protocol-specific fields
- formatting tests: `apiToYaml()` / `yamlToAPI()` preserve canonical ordering for `graphql` and `grpc` blocks

### Integration Tests

- GraphQL against a local test server (e.g. Apollo Server with a simple schema)
- gRPC against a local test server (Node `@grpc/grpc-js` server with a test `.proto`)
- Both wired through `runner.runFile` end-to-end

---

## Open Questions

1. **gRPC-Web:** Should we support `grpc-web` protocol for browser-based gRPC (relevant for webview "Try" buttons in docs)? This could use HTTP/1.1 with base64-encoded frames. Deferred to post-Phase 2.

2. **Proto path resolution:** Should `proto` paths be resolved relative to the `.mmt` file (like `import`), relative to the workspace root, or support both with a `proto_root` config in env files?

3. **GraphQL `errors` + `data`:** Some GraphQL APIs return partial data alongside errors. Should this still be marked as a failed run, or should we add a `graphql_strict: false` option?

4. **Bundle size:** `@grpc/grpc-js` + `@grpc/proto-loader` add ~2MB to the extension. Acceptable, or should gRPC be behind a lazy `require()`?

5. **Reflection caching scope:** Should reflected service definitions be cached per-run (current design), per-session, or persisted to disk? Disk caching would allow offline validation but adds staleness risk.

---

## See Also

- `sdd-feature-gaps.md` — Gap #3 (GraphQL) and #10 (gRPC)
- `sdd-competitive-strategy.md` — Priority 3a (GraphQL) and 3b (gRPC)
- `sdd-auth-helpers.md` — Auth system reused by both protocols
- `docs/api-mmt.md` — Current API syntax documentation
- [gRPC Server Reflection Protocol](https://github.com/grpc/grpc/blob/master/doc/server-reflection.md) — upstream spec for `grpc.reflection.v1`
