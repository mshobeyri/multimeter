# HTTP file

Use `.http` and `.https` files with Multimeter without giving up REST Client or JetBrains HTTP Client workflows.

## Run directly

In VS Code, open a `.http` or `.https` file with **Open With...** → **Multimeter HTTP Test Editor**. Each request runs as a test flow with Multimeter reporting, environments, and suite support.

The structured UI is read-only for HTTP files. Use **Save as MMT** in the editor to create an editable `type: test` file from the parsed requests.

## Import in tests

Reference HTTP files from `type: test` `.mmt` files. Multimeter converts the file to a test flow internally:

```yaml
type: test
title: Reuse HTTP requests
import:
  posts: echo_posts.http
steps:
  - call: posts
```

See [import](../files/test/import.md).

## Convert to MMT

Right-click a `.http`, `.https`, or `.rest` file in the Explorer and choose **Convert to MMT...**. Multimeter generates `api/` and `tests/` files — one API per request, plus a test file with sequential `call` steps for multi-request files.

Pick the generated files, a destination folder, and a collision policy (skip, overwrite, or rename).

Example output: [HTTP convert example](../../examples/intermediate/25_convert_to_mmt/http/README.md)

## Supported syntax

Targets VS Code REST Client and JetBrains HTTP Client syntax:

- Request separators (`###`), names (`# @name`), `METHOD URL` lines (with optional `HTTP/1.1` / `HTTP/2`)
- Headers and raw bodies (JSON, XML, text detection)
- File variables (`@host = ...`) and `{{variable}}` references
- System variables (`{{$guid}}`, `{{$uuid}}`, `{{$randomInt}}`, `{{$timestamp}}`, `{{$datetime}}`)
- Request chaining (`{{login.response.body.$.token}}`)
- Basic status checks from response scripts (`response.status === 200`)

Each request block maps to an internal `http` step with `debug: true` so responses appear in the run panel.

## Limitations

Not fully supported yet: pre-request scripts, full response handler execution, multipart/form-data parts, body file includes (`< ./payload.json`), cookie jars, redirect control, digest auth, AWS SigV4, and other tool-specific auth helpers.

Use editable `.mmt` files for advanced flow control, data-driven loops, mocks, load tests, and full environment presets.

## See also

- [Import HTTP in test example](../../examples/intermediate/15_http_files/README.md)
- [Bruno](./bruno.md) · [Postman](./postman.md) · [Test import](../files/test/import.md)
