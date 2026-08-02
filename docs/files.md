# Files

Multimeter projects are folders of YAML `.mmt` files. The top-level `type` field decides how a file behaves.

## File types

| Type | Purpose | Guide |
|---|---|---|
| `api` | Single HTTP / WebSocket / GraphQL / gRPC request | [API](./files/api.md) |
| `test` | Executable flow with steps and assertions | [Test](./files/test.md) |
| `env` | Variables, presets, certificates | [Environment](./files/env.md) |
| `suite` | Group and run tests or other suites | [Suite](./files/suite.md) |
| `doc` | Generate API documentation | [Doc](./files/doc.md) |
| `server` | Mock server endpoints | [Mock Server](./files/server.md) |
| `loadtest` | Concurrency / ramp-up load scenario (beta) | [Load Test](./files/loadtest.md) |
| `report` | Structured results (usually generated) | [Report](./files/report.md) |

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

## Other formats

Multimeter can also open `.http` / `.https` (REST Client style) and Bruno `.bru` files via **Open With**. See [HTTP files](./features/http-files.md) and [Bruno files](./features/bruno-files.md).

## Next steps

- [Start with a task](./tasks/index.md)
- [Browse examples](/docs/examples)
- [Sample Project](./guides/sample-project.md)
