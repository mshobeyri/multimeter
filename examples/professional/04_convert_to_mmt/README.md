# Convert Multimeter Test Server sources

Full [test.mmt.dev](https://test.mmt.dev) coverage across every import format Multimeter supports. Use **Open as MMT** or **Convert to MMT...**.

[Intermediate convert](../../intermediate/25_convert_to_mmt/) keeps one-request samples. This folder presents the public sandbox endpoints (samples, echo, status, auth, inspect).

| Folder | Source | Notes |
|---|---|---|
| `openapi/` | `source.openapi.yaml` | Full OpenAPI 3 for the sandbox |
| `http/` | `source.http` | All HTTP endpoints in one file |
| `bruno/` | `*.bru` + `bruno.json` | Bruno collection (open the folder or a request) |
| `postman/` | `source.postman_collection.json` | Postman collection with folders |
| `wsdl/` | `source.wsdl` | Multi-operation WSDL convert sample (`/xml`) |

WebSocket `WS /ws` is listed on the sandbox help page but is not exported from OpenAPI/HTTP/Bruno/Postman convert — add WS APIs manually if you need them.

## How to use

### Open as MMT

1. Right-click a source file (or Bruno collection folder) → **Open as MMT**
2. Pick an operation / request from the selector
3. Send — responses come from `https://test.mmt.dev`

### Convert to MMT

1. Right-click the source → **Convert to MMT...**
2. Compare with the matching `converted/` tree

Auth probes use `Bearer testtoken` and Basic `user` / `pass`.
