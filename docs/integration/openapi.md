# OpenAPI spec

Bootstrap Multimeter API files from OpenAPI 3.x (JSON or YAML) or Swagger specs.

## Open as MMT

Right-click an OpenAPI/Swagger file and choose **Open as MMT**, or use **Open With...** → **Multimeter Spec Editor**. The left pane stays the spec. Pick an operation or a named example from the selector, then Send. Hover a list item for **Save as MMT**.

## Convert to MMT

1. Right-click an OpenAPI/Swagger file (for example `openapi.yaml`, `openapi.json`, `swagger.yaml`) in the VS Code Explorer
2. Choose **Convert to MMT...**
3. Select the generated files, pick a destination folder, and choose a collision policy

Multimeter generates `type: api` files under `api/` with protocol, method, URL, headers, body, inputs, and examples inferred from the spec.

## What Multimeter maps

- Path, query, and header parameters → API `inputs`
- Request/response schemas → body templates and `format`
- **XML bodies** — when a spec defines `application/xml`, Multimeter generates XML body templates from the schema
- Example payloads from the spec when available

## Notes and limits

- WebSocket endpoints are **not** exported from OpenAPI — add WS APIs manually in the API editor
- Advanced schema features (oneOf/anyOf, polymorphism) may need simplification in generated bodies
- Complex auth flows may require manual touch-ups after import

## Tips after import

- Map your base URL to an environment variable (for example `api_url`) and reference it with `<<e:api_url>>`
- Review generated inputs and headers before writing tests
- Use the API editor to refine bodies and add `setenv` for downstream tests

Basic convert: [one-operation OpenAPI example](../../examples/intermediate/25_convert_to_mmt/openapi/README.md)

Full spec (operations, named examples, auth, schemas): [Library API example](../../examples/professional/04_convert_to_mmt/openapi/README.md)

## See also

- [Postman](./postman.md) · [WSDL](./wsdl.md) · [API files](../files/api/index.md) · [Test](../files/test/index.md)
