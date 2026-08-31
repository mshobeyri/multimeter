# Convert a full OpenAPI spec

OpenAPI for the public [test.mmt.dev](https://test.mmt.dev) Multimeter Test Server. Use **Open as MMT** or **Convert to MMT...**.

The spec covers the features Multimeter maps from OpenAPI:

- Multiple paths and methods (`GET`, `POST`, `PUT`, `DELETE`)
- Named request examples (the Open as MMT tree shows each operation and its examples)
- Path, query, and header parameters
- Shared `components` (schemas, parameters, responses, bearer and basic auth)
- Tags, servers, and operation descriptions

Operations match real sandbox endpoints (`/json`, `/echo`, `/status/{code}`, `/auth/bearer`, …), so Send works after you pick an operation.

## Files

| Path | Description |
|---|---|
| `openapi/source.openapi.yaml` | Full OpenAPI 3 spec for test.mmt.dev |
| `openapi/converted/api/` | Expected `type: api` files from **Convert to MMT...** |

## How to use

### Open as MMT

1. Right-click `openapi/source.openapi.yaml` → **Open as MMT**
2. Pick an operation, or expand it and pick a named example
3. Send the request

### Convert to MMT

1. Right-click `openapi/source.openapi.yaml` → **Convert to MMT...**
2. Compare the generated files with `openapi/converted/api/`

For the one-operation convert walkthrough, see [intermediate convert](../../intermediate/25_convert_to_mmt/).
