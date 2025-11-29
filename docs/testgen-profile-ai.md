# MMT TestGen Profile v1

This profile guides AI/tools to generate Multimeter (MMT) tests from user descriptions, OpenAPI specs, or Postman collections. Read this document fully before generating any output. Generate artifacts deterministically based on the rules below. Do not deviate from specified structures or add unsupported features.

## Generation Workflow

1. **Parse Source**: Identify input type (OpenAPI 3.x > Postman v2.x > free-form description). Use common filenames for discovery.
2. **Map to APIs**: Create `type: api` files for each endpoint. Include inputs, examples. For WebSocket, use `protocol: ws` (no `method`).
3. **Generate Tests**: Produce smoke tests (required) + optional negative/boundary. Use `call`, `assert`, `check` steps. For WebSocket requests, generate both API and test files.
4. **Handle Data**: Use `r:`, `c:`, `e:` tokens for dynamics. Honor schemas.
5. **Output Files**: Name APIs as `{method}-{path}.mmt`, tests as `{suite}-{api}.mmt`. Include env if needed.
6. **Validate**: Match structures below exactly.

## Sources and Precedence

- OpenAPI: Map base URL, auth via headers/JS, URL/path, method, inputs (params + body), examples.
- WebSocket: Synchronous req-res; URL (ws://), body as message, response as reply. No method.
- Postman: Map base URL, inputs (url, headers, body), examples.
- Description: Infer from text.

## Test Strategy

Suites: smoke (required, prefer examples), negative (invalid inputs), boundary (edge cases). Timeouts: 5s connect, 10s read. No retries.

## Data Generation

Use tokens: `i:<name>` (inputs), `e:<VAR>` (env, `<<e:VAR>>` in strings), `r:<type>` (random), `c:<name>` (current). Prefer these over literals.

## Environment and Auth

Require `API_URL`; optional `TOKEN`/`API_KEY`. Default headers: User-Agent, Accept, Connection, Accept-Encoding. Block with `_`.

## Generated Artifacts

### APIs
- Structure: `type: api`, title, protocol (http|ws), method (HTTP only), url, inputs, body, examples.
- Inputs: Use primitives or tokens (e.g., `name: r:firstName`). Place after title/description.
- WebSocket: `protocol: ws`, body as sent message.

### Tests
- Structure: `type: test`, title, steps (call, assert, check).
- Layout: Sequential. Assertions: assert for fatal, check for non-fatal.

### Environments
- Structure: `type: env`, variables (API_URL, etc.), presets.

### Docs
- Structure: `type: doc`, title, sources.

## Naming and Structure

- APIs: `{method}-{path}.mmt`.
- Tests: `{suite}-{api}.mmt`.
- Normalize paths; sort inputs.

## Skeletons (for Scaffolding)

- api: `type: api\ntitle: ${TITLE}\nprotocol: http\nmethod: get\nurl: <<e:API_URL>>/${API_NAME}\ninputs: {}\n`
- test: `type: test\ntitle: ${TITLE}\nsteps:\n  - call: ${API_NAME}\n  - assert: status == 200\n`
- env: `type: env\nvariables:\n  API_URL: https://api.example.com\n  TOKEN: your-token\n`
- doc: `type: doc\ntitle: ${TITLE}\nsources:\n  - ./apis\n`

## Response Guidelines

- If user provides a description/spec, generate YAML for APIs, tests, env as needed.
- Output in ```yaml blocks.
- For modifications, output only the changed YAML.
- Ask for clarification if input is ambiguous.
- Be concise; no extra text unless explaining.

## Examples

From OpenAPI `/users` POST:
- API: `type: api\ntitle: Create User\nprotocol: http\nmethod: post\nurl: https://api.example.com/users\ninputs:\n  name: r:firstName\n  email: r:email\nbody:\n  name: i:name\n  email: i:email\nexamples:\n  - name: Valid User\n    inputs:\n      name: "John"\n      email: "john@example.com"\n`
- Test: `type: test\ntitle: Create User Test\nsteps:\n  - call: users-api\n    inputs:\n      name: "Test User"\n      email: "test@example.com"\n  - assert: status == 201\n  - check: response.id != null\n`
- Env: `type: env\nvariables:\n  API_URL: https://api.example.com\n`

For WebSocket: `type: api\nprotocol: ws\nurl: wss://ws.example.com/chat\ninputs:\n  greeting: "Hello"\nbody: i:greeting\n`

## Structures Reference

### API
```yaml
type: api
title: string
protocol: http | ws
method: get|post|...  # HTTP only
url: string
inputs: record<string, primitive>
body: object|string|null
examples: Array<{name: string, inputs?: record<string, primitive>}>
```

### Test
```yaml
type: test
title: string
steps: Array<call|assert|check>
```

### Env
```yaml
type: env
variables: record<string, primitive>
```

### Doc
```yaml
type: doc
title: string
sources: string[]
```