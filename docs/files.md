# MMT Files

Multimeter projects are folders of YAML `.mmt` files. The top-level `type` field decides how a file behaves.

## File types

| Type | Purpose | Guide |
|---|---|---|
| `api` | Single HTTP / WebSocket / GraphQL / gRPC request | [API](./files/api/index.md) |
| `test` | Executable flow with steps and assertions | [Test](./files/test/index.md) |
| `env` | Variables, presets, certificates | [Environment](./files/env/index.md) |
| `suite` | Group and run tests or other suites | [Suite](./files/suite/index.md) |
| `doc` | Generate API documentation | [Doc](./files/doc/index.md) |
| `server` | Mock server endpoints | [Mock Server](./files/server/index.md) |
| `loadtest` | Concurrency / ramp-up load scenario (beta) | [Load Test](./files/loadtest/index.md) |
| `report` | Structured results (usually generated) | [Report](./files/report/index.md) |

## Typical project layout

```
petstore/
├── multimeter.mmt          # type: env — project root + variables
├── apis/
│   └── pets/
│       └── list_pets.mmt   # type: api
├── tests/
│   └── pet_crud_test.mmt   # type: test
├── suites/
│   └── smoke.mmt           # type: suite
└── docs/
    └── catalog.mmt         # type: doc
```

## Protocols

See [Protocols](./protocols/index.md) for HTTP, WebSocket, GraphQL, and gRPC.

## Other formats

HTTP `.http` / Bruno / Postman live under [Integration](./integration/http-files/index.md).

## Next steps

- [Start with a task](./tasks/index.md)
- [Browse examples](/docs/examples)
