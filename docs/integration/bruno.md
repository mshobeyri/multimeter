# Bruno

Use Bruno `.bru` and `.bruno` request files with Multimeter while keeping Bruno-compatible source files.

## Run directly

In VS Code, open a `.bru` file with **Open With...** → **Multimeter Bruno Test Editor**. The request runs as a test flow with Multimeter reporting, environments, and suite support.

The structured UI is read-only for Bruno files. Use **Save as MMT** in the editor to create an editable `type: test` file from the parsed request.

## Import in tests

Reference Bruno files from `type: test` `.mmt` files:

```yaml
type: test
title: Reuse Bruno request
import:
  profile: requests/get_profile.bru
steps:
  - call: profile
```

See [import](../files/test/import.md).

## Convert to MMT

Right-click a `.bru` or `.bruno` file in the Explorer and choose **Convert to MMT...**. Multimeter generates matching `api/` and `tests/` files you can edit in the normal Multimeter UI.

Example output: [Bruno convert example](../../examples/intermediate/25_convert_to_mmt/bruno/README.md)

## Supported syntax

Common single-request `.bru` structure:

- `meta.name` → test title and request id
- HTTP method blocks: `get`, `post`, `put`, `patch`, `delete`, `head`, `options`, `trace`
- `url`, `body`, and `auth` from the method block
- `headers`, `params:query`, and `body:json` / `body:xml` / `body:text`
- `auth:bearer` → `Authorization: Bearer ...` header
- `vars:*` blocks for local substitution; `{{name}}` resolves from Bruno vars, then `<<e:name>>`
- Random variables (`{{$uuid}}`, etc.) map to Multimeter `r:` tokens
- Simple `expect(res.status).to.equal(200)` assertions become Multimeter `expect` checks

## Limitations

- Bruno collection folders are not expanded automatically — import or open individual `.bru` files
- Pre-request and post-response scripts are not executed as Bruno scripts
- File bodies, multipart helpers, and advanced auth may need conversion to editable `.mmt` for full control

## See also

- [Import Bruno in test example](../../examples/intermediate/16_bruno_files/README.md)
- [HTTP file](./http-file.md) · [Postman](./postman.md)
