# Multimeter overview (min)

Prefer MCP tools when available. Offline: `testlight docs`, `testlight scaffold`, `testlight validate`.

## Types

- `api` — one endpoint
- `test` — call APIs/tests + assert
- `env` — variables/presets
- `suite` — group runnable files
- `doc` / `server` / `loadtest` / `report` — as named

## Tokens

- `e:name`, `i:name`, `r:uuid`, `c:epoch_ms`
- Embed with `<<e:api_url>>/path`

## Agent loop

1. New test from API → `scaffold_test` / `testlight scaffold test --from`
2. Patch only on modify
3. `validate` before finishing
4. Never web-search Multimeter syntax

Request `pack: full` only when min docs are not enough.
