# Postman

Import Postman Collection v2 exports into editable Multimeter projects.

## Open as MMT

Right-click a Postman collection JSON and choose **Open as MMT**, or use **Open With...** → **Multimeter Spec Editor**. The collection stays on the left. Pick a request or a saved example from the selector, then Send. Hover a list item for **Save as MMT**.

## Convert to MMT

1. Export or save your Postman collection as JSON
2. Right-click the collection file in the VS Code Explorer
3. Choose **Convert to MMT...**
4. Select the generated files, pick a destination folder, and choose a collision policy

Multimeter turns collection requests into `type: api` files and optional tests and suites you can run in the UI or with Testlight.

## What gets generated

- **API files** — protocol, method, URL, headers, body, inputs, and examples when available
- **Tests** — one test per request that imports and calls the generated API
- **Suites** — Postman folders become suites that run folder tests and child-folder suites in sequence
- **Large collections** (5+ APIs) — also generate `multimeter.mmt` with `+/` imports

## Postman-specific mapping

- Dynamic variables (`{{$guid}}`, `{{$randomEmail}}`, `{{$randomInt}}`) → Multimeter `r:` tokens (`r:uuid`, `r:email`, `r:int`, …)
- `formdata` and `urlencoded` body modes → Multimeter bodies with `format: urlencoded` where applicable
- Saved response examples with `originalRequest` → auto-generated inputs, header placeholders, and example overrides
- Unsupported Postman scripts → preserved as `js` steps with review comments

Complex auth flows and Postman sandbox APIs may need manual touch-ups after import.

## Tips after import

- Map your base URL to an environment variable (for example `api_url`) and reference it with `<<e:api_url>>`
- Review generated inputs and headers — tweak names to match your project
- Use the API editor to refine bodies and add `setenv` for downstream tests

Example output: [Postman convert example](../../examples/intermediate/25_convert_to_mmt/postman/README.md)

Full sandbox Postman collection: [professional Postman convert](../../examples/professional/04_convert_to_mmt/postman/README.md)

## See also

- [OpenAPI spec](./openapi.md) · [HTTP file](./http-file.md) · [Bruno](./bruno.md) · [Environment](../files/env/index.md)
