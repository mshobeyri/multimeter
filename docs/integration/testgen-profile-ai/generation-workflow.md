# Generation Workflow

1. **Parse Source**: Identify input type (OpenAPI 3.x > Postman v2.x > free-form description). Use common filenames for discovery.
2. **Map to APIs**: Create `type: api` files for each endpoint. Include inputs, examples. For WebSocket, use `protocol: ws` (no `method`).
3. **Generate Tests**: Produce smoke tests (required) + optional negative/boundary. Use `call`, `assert`, `check` steps. For WebSocket requests, generate both API and test files.
4. **Handle Data**: Use `r:`, `c:`, `e:` tokens for dynamics. Honor schemas.
5. **Output Files**: Name APIs as `{method}-{path}.mmt`, tests as `{suite}-{api}.mmt`. Include env if needed.
6. **Validate**: Match structures below exactly.
