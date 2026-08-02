# OpenAPI, WSDL, HTTP, and Bruno

Source-specific conversion details. See [What gets generated](./generated-output.md) for the overall output layout, and [Postman features](./generated-postman.md) for collections.

### OpenAPI
- **XML body generation**: When a spec defines content types like `application/xml`, the convertor generates XML body templates from the schema.
- Advanced schema features (oneOf/anyOf, polymorphism) may need simplification in generated bodies.
- WebSocket endpoints are not exported from OpenAPI; add WS APIs manually in the API editor.

### WSDL
- **SOAP API generation**: WSDL operations become XML API files with SOAP envelopes, endpoint URLs, and SOAPAction headers.

### HTTP and Bruno
- **Editable tests**: `.http`, `.https`, `.bru`, and `.bruno` files can be converted into MMT files while still remaining runnable directly.
- **API extraction**: Requests with a valid HTTP method and URL generate an `api/` file plus a `tests/` file that imports and calls it. Multi-request HTTP files generate one API per request and a single test file with sequential `call` steps.
- **Safe step ids**: Converted tests keep import aliases unchanged, but prefix generated step `id` values with `i` so they do not collide with the import binding in generated JavaScript (for example, `call: ping` with `id: iPing`). HTTP and Bruno inline step ids are only prefixed when they match reserved words or test-flow keywords.
- **Response debug**: Converted request steps include `debug: true` so responses are visible in the run output on first run.
- **HTTP runtime mapping**: When you open a `.http` file in the Multimeter HTTP editor, each request is converted to an internal test step with `debug: true` so responses appear in the run panel without saving to `.mmt` first.

See also: [What gets generated](./generated-output.md) · [Postman features](./generated-postman.md) · [HTTP Files](../http-files/index.md) · [Bruno Files](../bruno-files/index.md)
