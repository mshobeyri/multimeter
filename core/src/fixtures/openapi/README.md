# OpenAPI test fixtures

Committed specs used by `openapiConvertor.fixtures.test.ts` and `importConvertor` fixture tests.

| File | Source | Notes |
|------|--------|-------|
| `petstore3.openapi.json` | https://petstore3.swagger.io/api/v3/openapi.json | OpenAPI 3.0.4 JSON (Swagger Petstore) |
| `petstore.swagger2.json` | https://petstore.swagger.io/v2/swagger.json | Swagger 2.0 JSON (classic Petstore) |
| `convert-example.openapi.yaml` | `examples/intermediate/25_convert_to_mmt/openapi/source.openapi.yaml` | Small YAML OpenAPI 3 fixture |
| `sample-bearer.openapi.json` | Hand-written | Minimal JSON spec for auth, path/query, and named examples |

Fixtures are pinned in-repo so unit tests do not depend on live network fetches.
