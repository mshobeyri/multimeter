# Bruno

Use Bruno `.bru` and `.bruno` request files with Multimeter while keeping Bruno-compatible source files.

## Run directly

In VS Code, open a `.bru` file with **Open With...** → **Multimeter Bruno Test Editor**, or **Open as MMT**.

The selector lists **All** (the file or collection as one test) and each request. Hover a list item for **Save as MMT**. The left editor stays on the file you opened.

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

## Collections

A Bruno collection is a folder with `bruno.json` and one `.bru` file per request. Opening any request file loads the siblings (skipping `collection.bru`, `folder.bru`, `environments/`, and paths listed in `bruno.json` `ignore`).

Requests are ordered by `meta.seq`, then file path. Convert to MMT still works one file at a time.

## Limitations

- Pre-request and post-response scripts are not executed as Bruno scripts
- File bodies, multipart helpers, and advanced auth may need conversion to editable `.mmt` for full control

## See also

- [Bruno file examples](../../examples/intermediate/16_bruno_files/README.md) — start with `library/` for a collection, or `checkout_book_complete.bru` for a single request
- [HTTP file](./http-file.md) · [Postman](./postman.md)
