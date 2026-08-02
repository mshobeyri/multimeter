# Multimeter overview

Short map of Multimeter concepts. Prefer task guides and [MMT Files](./files.md) for details.

Multimeter uses YAML `.mmt` files with a top-level `type` field. That type decides how the file behaves.

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

| Type | Purpose | Docs |
|------|---------|------|
| `api` | Single HTTP / WebSocket / GraphQL / gRPC request | [API](./files/api/index.md) |
| `test` | Executable flow with steps and assertions | [Test](./files/test/index.md) |
| `env` | Variables, presets, certificates | [Environment](./files/env/index.md) |
| `suite` | Group and run tests or other suites | [Suite](./files/suite/index.md) |
| `doc` | Generate API documentation | [Doc](./files/doc/index.md) |
| `server` | Mock server endpoints | [Mock Server](./files/server/index.md) |
| `loadtest` | Concurrency / ramp-up load scenario (beta) | [Load Test](./files/loadtest/index.md) |
| `report` | Structured results (usually generated) | [Report](./files/report/index.md) |

## See also

- [MMT Files](./files.md) — full reference by type
- [Protocols](./protocols/index.md) — HTTP, WebSocket, GraphQL, gRPC
- [Quick Start](./quick-start.md)
- [Browse examples](/docs/examples)
