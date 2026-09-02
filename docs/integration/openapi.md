# OpenAPI spec

Bootstrap Multimeter API files from OpenAPI 3.x (JSON or YAML) or Swagger specs.

## Run directly

See [Spec editor](./spec-editor.md) for the {{btn:list-tree}} request picker and {{btn:save-as}}.

In VS Code, right-click an OpenAPI or Swagger file (`.yaml`, `.yml`, `.json`) and choose **Open as MMT**, or use **Open With...** → **Multimeter Spec Editor**. The spec stays on the left.

Click {{btn:list-tree}}, pick an **operation** or a **named example** ({{btn:lightbulb}} child row), then {{btn:send:Send}}. There is no **All** row for OpenAPI — each operation runs as a single API send. Hover a row for **Save as MMT**.

## Convert to MMT

1. Right-click an OpenAPI/Swagger file (for example `openapi.yaml`, `openapi.json`, `swagger.yaml`) in the VS Code Explorer
2. Choose **Convert to MMT...**
3. Select the generated files, pick a destination folder, and choose a collision policy

Multimeter generates `type: api` files under `api/` with protocol, method, URL, headers, body, inputs, and examples inferred from the spec.

## What Multimeter maps

- Path, query, and header parameters → API `inputs` (including shared `#/components/parameters/...` refs)
- Request/response schemas → body templates and `format` (including `#/components/schemas/...` and `#/components/requestBodies/...` refs in the same file)
- **XML bodies** — when a spec defines `application/xml`, Multimeter generates XML body templates from the schema
- Example payloads from the spec when available (inline `example` / `examples` on the operation or media type)

## Notes and limits

- **Internal `$ref` only** — Multimeter resolves same-file JSON Pointer refs (`#/components/...`, Swagger 2 `#/definitions/...`). External file refs (`other.yaml#/...`) are not followed automatically.
- WebSocket endpoints are **not** exported from OpenAPI — add WS APIs manually in the API editor
- Advanced schema features (oneOf/anyOf, polymorphism) may need simplification in generated bodies
- Complex auth flows may require manual touch-ups after import

## Tips after import

- Map your base URL to an environment variable (for example `api_url`) and reference it with `<<e:api_url>>`
- OpenAPI `servers[].variables` (`{host}`, `{environment}`, …) are converted to `<<e:host>>` tokens automatically; **Convert to MMT** also writes a `multimeter.mmt` env file with defaults and enum choices when those placeholders are present
- Unquoted YAML like `url: {base_url}` is supported (YAML parses it as a flow mapping); prefer quoted `url: '{base_url}'` or a full template such as `url: https://{host}/v1` with a `variables:` block for strict OpenAPI tooling
- Review generated inputs and headers before writing tests
- Use the API editor to refine bodies and add `setenv` for downstream tests

Basic convert: [one-operation OpenAPI example](../../examples/intermediate/25_convert_to_mmt/openapi/README.md)

Full sandbox coverage (OpenAPI, HTTP, Bruno, Postman, WSDL): [Multimeter Test Server convert examples](../../examples/professional/04_convert_to_mmt/README.md)

## See also

- [Postman](./postman.md) · [WSDL](./wsdl.md) · [API files](../files/api/index.md) · [Test](../files/test/index.md)
