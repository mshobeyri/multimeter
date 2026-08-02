# MMT Files

Multimeter projects are folders of YAML `.mmt` files. The top-level `type` field decides how a file behaves.

## Shared metadata

Most authored file types share the same documentation fields:

| Field | Purpose |
|---|---|
| `title` | Display name in the UI, docs, and reports |
| `description` | Longer explanation (Markdown supported on APIs) |
| `tags` | Labels for search and filtering |

They appear on **API**, **Test**, **Suite**, **Load Test**, and **Mock Server** files.

**Doc** files use `title` and `description` (no `tags`). **Environment** and **Report** files do not use this trio.

```yaml
type: api   # or test | suite | loadtest | server
title: Login
description: Authenticate and return a token
tags:
  - smoke
  - auth
```

## File types

| | Type | Purpose | Guide |
|---|---|---|---|
| $(symbol-method) | `api` | Single HTTP / WebSocket / GraphQL / gRPC request | [API](./files/api/index.md) |
| $(beaker) | `test` | Executable flow with steps and assertions | [Test](./files/test/index.md) |
| $(server-environment) | `env` | Variables, presets, certificates | [Environment](./files/env/index.md) |
| $(layers) | `suite` | Group and run tests or other suites | [Suite](./files/suite/index.md) |
| $(book) | `doc` | Generate API documentation | [Doc](./files/doc/index.md) |
| $(server) | `server` | Mock server endpoints | [Mock Server](./files/server/index.md) |
| $(dashboard) | `loadtest` | Concurrency / ramp-up load scenario (beta) | [Load Test](./files/loadtest/index.md) |
| $(file-text) | `report` | Structured results (usually generated) | [Report](./files/report/index.md) |

## Protocols

Protocol details live under [API → Protocols](./api/protocols/index.md) (HTTP, WebSocket, GraphQL, gRPC).

## Other formats

HTTP `.http` / Bruno / Postman live under [Integration](./integration/http-files/index.md).

## Next steps

- [Quick Start](./quick-start.md)
- [Start with a task](./tasks/index.md)
- [Browse examples](/docs/examples)
