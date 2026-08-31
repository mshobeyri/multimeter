# Bruno

Use Bruno `.bru` and `.bruno` request files with Multimeter while keeping Bruno-compatible source files.

## Run a request

In VS Code, open a `.bru` file with **Open With...** → **Multimeter Bruno Test Editor**, or **Open as MMT**.

The selector lists **All** (that request as one test) and the request as an API (with examples when present). Hover a list item for **Save as MMT**. The left editor stays on the file you opened.

Opening a single `.bru` does **not** pull in sibling requests from the collection.

## Run a collection

Open the collection’s `bruno.json` the same way (**Open With...** / **Open as MMT**). Multimeter walks the collection folder (skipping `collection.bru`, `folder.bru`, `environments/`, and paths listed in `bruno.json` `ignore`) and shows:

- **All** — every request as one sequential test
- Each request as an API (with examples)

The left editor shows `bruno.json` (JSON). Requests are ordered by `meta.seq`, then file path.

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

Full sandbox Bruno collection: [professional Bruno convert](../../examples/professional/04_convert_to_mmt/bruno/README.md)

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

- Pre-request and post-response scripts are not executed as Bruno scripts
- File bodies, multipart helpers, and advanced auth may need conversion to editable `.mmt` for full control

## See also

- [Bruno file examples](../../examples/intermediate/16_bruno_files/README.md) — open `library/bruno.json` for the full collection, or any `.bru` for a single request
- [HTTP file](./http-file.md) · [Postman](./postman.md)
