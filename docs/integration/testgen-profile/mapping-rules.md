# Mapping rules

### OpenAPI → MMT
- Base URL: first server url
- Auth: Not directly supported; handle via custom headers (e.g., `Authorization: Bearer <<e:token>>`) or JS code in tests.
- URL = path + resolved query params
- Method = `operationId` if available, else the HTTP method
- Inputs = union of parameters + requestBody.schema
- Examples = from `operation.examples` or schema examples when present

### WebSocket → MMT
- Treated as synchronous request-response protocol (similar to HTTP).
- URL: WebSocket endpoint (ws:// or wss://).
- Body: Message payload sent to the server.
- Response: Expected reply message.
- Auth: Via headers or query params if supported.
- Inputs/Examples: Parameterize messages and expected responses.
- Generation rules:
  - Do NOT include `method` for `protocol: ws` APIs.
### Postman → MMT
- Base URL: collection variable `api_url` if present; else inferred
- Inputs:
  - `url` → `i:url`
  - `headers` → `i:hdr_<headerName>`
  - `body` → `i:body`
- Examples override different inputs per example; if only responses exist, emit name-only examples
