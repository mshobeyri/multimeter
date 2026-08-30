# Convert to MMT

Minimal source files that show the **Convert to MMT...** workflow. Right-click a source file, convert it, and compare the result with the matching `converted/` folder.

Each format is one request or one operation so the mapping stays easy to read.

| Folder | Source | What you get |
|---|---|---|
| `openapi/` | `source.openapi.yaml` | One `type: api` file |
| `postman/` | `source.postman_collection.json` | API, test, and suite files |
| `wsdl/` | `source.wsdl` | One SOAP `type: api` file |
| `http/` | `source.http` | API plus a test that calls it |
| `bruno/` | `source.bru` | API plus a test that calls it |

All live HTTP examples target [test.mmt.dev](https://test.mmt.dev).

For a full OpenAPI spec with many operations, named examples, auth, and schemas, see [professional convert](../../professional/04_convert_to_mmt/).
