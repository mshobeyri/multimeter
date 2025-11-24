# MMT TestGen Profile v1

A practical profile that guides AI/tools to generate Multimeter tests from user descriptions, Postman collections, or OpenAPI specs.

This document explains the intent and gives examples; the machine-readable counterpart lives at `.mmt/testgen.profile.yaml`.

## Generation Workflow (For AI/Tools)

Follow these steps to generate MMT artifacts:

1. **Parse Source**: Identify input type (OpenAPI, Postman, description). Use precedence order.
2. **Map to APIs**: Create `type: api` files for each endpoint, using mapping rules. Include inputs, examples.
3. **Generate Tests**: Produce smoke tests (required) and optional negative/boundary. Use `call`, `assert`, `check` steps. When user explicitly requests a *WebSocket sample test*, generate BOTH:
  - a `type: api` file with `protocol: ws`
  - a `type: test` file calling that ws api (single `call` + `assert`/`check`).
4. **Handle Data**: Use `r:`, `c:`, `e:` tokens for dynamic/random values. Honor schema constraints.
5. **Output Files**: Name as `{method}-{path}.mmt` for APIs, group in suites for tests. Include env file if needed.
6. **Validate**: Ensure generated YAML matches structures below. Skip unsupported features.

## Goals

- Consistent mapping from OpenAPI/Postman/description to MMT APIs and tests
- Pragmatic defaults; minimal edits after generation
- Safe-by-default (no secrets, rate-limit aware)

## Sources and precedence

Preferred sources in order:
1) OpenAPI (3.x)
2) Postman (v2.x)
3) Free-form description

Other specs (e.g., GraphQL, RAML) not supported; REST APIs only. Tools should attempt discovery using common filenames (openapi.yaml/yml/json, swagger.yaml) and `postman/*.json`.

## Mapping rules

### OpenAPI → MMT
- Base URL: first server url
- Auth: Not directly supported; handle via custom headers (e.g., `Authorization: Bearer <<e:TOKEN>>`) or JS code in tests.
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
- Base URL: collection variable `API_URL` if present; else inferred
- Inputs:
  - `url` → `i:url`
  - `headers` → `i:hdr_<headerName>`
  - `body` → `i:body`
- Examples override different inputs per example; if only responses exist, emit name-only examples

## Test strategy

Provide three suites:
- smoke (required): at least one per endpoint; prefer examples
- negative: one per endpoint when feasible; users can pass invalid inputs manually
- boundary: one per endpoint when feasible

Timeouts: connect 5s, read 10s. Retries: off by default.

Performance testing: Not yet supported; working on it. For now, use `check` steps in tests for response validation (see docs/test-mmt.md).

## Data generation

Prefer built-in tokens:
- Random (`r:`): uuid, bool, int, etc.
- Current (`c:`): date, epoch, etc.
Honor schema constraints (e.g., min/max, regex) when available.

Examples:
```yaml
headers:
  X-Req: req-<<r:uuid>>
body:
  id: r:int
  created_at: c:epoch
  active: r:bool
```

### Token Prefix Summary

Use these compact prefixes to indicate dynamic values. Generators and AI should prefer them over hard‑coded literals.

- `i:<name>` – Input parameter placeholder (declared under `inputs:` in an API or test). Example: `inputs: { userId: string }` then use `{{userId}}` or `i:userId` depending on context.
- `e:<VAR>` – Environment variable reference (type‑preserving). Inside strings use `<<e:VAR>>`; standalone use `e:VAR`.
- `r:<type>` – Random value generator. Common types: `r:uuid`, `r:int`, `r:bool`, `r:email` (if supported). Honors constraints when possible.
- `c:<name>` – Current/time/system value. Examples: `c:epoch`, `c:date`, `c:millis`.

Guidelines:
- Prefer `e:` for secrets / deployment specifics, `r:` for variability, `c:` for timestamps, `i:` for test/API parameterization.
- Do not mix `<<e:VAR>>` with other token syntaxes inside the same scalar unless needed (avoid confusing expansions).
- In examples, override only `inputs` values—not environment or random tokens (those remain dynamic).


## Environment and auth

Expect `API_URL`; optionally `TOKEN`/`API_KEY` depending on the API.
Default headers:
- User-Agent: Multimeter
- Accept: */*
- Connection: keep-alive
- Accept-Encoding: gzip, deflate, br

Block any with `_` if needed; Content-Type/Length are inferred when a body exists.

## What gets generated: APIs, Tests, Environments

This profile guides three artifact types. For full syntax and capabilities, see:
- API files: see docs/api-mmt.md
- Test files: see docs/test-mmt.md
- Environment files: see docs/environment-mmt.md

### APIs
- Inputs are placed right after title/description for readability
- Base request is parameterized; examples override only changed inputs
- Default headers can be blocked via `_` when needed
- Random/current tokens (r:/c:) are encouraged for stable, useful data

Generation knobs (see YAML profile):
- includeExamples: whether to emit examples blocks
- includeDocs: whether to add title/description/tags scaffolding
- defaults.headers.block: list of headers to block by default

### Tests
- Suites: smoke (required), negative/boundary (optional) as configured
- Flow style: sequential by default; stages/parallel when explicitly enabled
- Assertions: assert by default; checks can be used for non-fatal validations (e.g., response content checks)
- Chaining: Supported via outputs/inputs in test steps (see docs/test-mmt.md)

Generation knobs (see YAML profile):
- strategy.suites: controls which suites to generate and selection rules
- test.layout: sequential vs staged, assert vs check
- naming: patterns for files/suites/examples

### Environments
- Expect at least API_URL; TOKEN/API_KEY optional depending on auth
- Presets (dev/prod) are supported via env files; users can choose at runtime
- Use `e:VAR` tokens directly in APIs/tests for type-preserving substitution; use `<<e:VAR>>` inside strings

Generation knobs (see YAML profile):
- env.file: default environment file path
- env.required/optional: variables to expect
- env.generateSkeleton: whether to emit a starter env file

## Naming & structure

- api file: `{method}-{path}.mmt`
- normalize path segments and sort inputs beneath title/description
- examples are included and can be run as smoke checks

Versioning: Not yet supported.

## Outputs for chaining

Guess common keys: id, name, status. Add explicit ones if known. Chaining happens in `type: test` files via step outputs/inputs (see docs/test-mmt.md).

## Machine-readable profile

The companion YAML lives at `.mmt/testgen.profile.yaml` and is used by tools for deterministic behavior. Keep the YAML as the source of truth for settings and update this document for rationale and examples.

### Skeletons
Starter templates are included for quick scaffolding:

- api
  - Minimal HTTP API with inputs just after title/description; empty headers/query/body ready to fill
- test
  - Simple flow calling one API and asserting status 200
- env
  - Basic environment with `API_URL` and optional `TOKEN`
- doc
  - Minimal doc pointing to `./examples`

Tools can substitute placeholders like `${TITLE}`, `${DESCRIPTION}`, and `${API_NAME}` before writing files.

## End-to-End Example

From OpenAPI snippet:
```yaml
openapi: 3.0.0
paths:
  /users:
    post:
      summary: Create user
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                name: {type: string}
                email: {type: string}
```

Generated MMT files:

**users-api.mmt**:
```yaml
type: api
title: Create User
protocol: http
method: post
url: https://api.example.com/users
inputs:
  name: string
  email: string
body:
  name: i:name
  email: i:email
examples:
  - name: Valid User
    inputs:
      name: "John"
      email: "john@example.com"
```

**users-test.mmt**:
```yaml
type: test
title: Create User Test
steps:
  - call: users-api
    inputs:
      name: "Test User"
      email: "test@example.com"
  - assert: status == 201
  - check: response.id != null
```

**env.mmt**:
```yaml
type: env
variables:
  API_URL: https://api.example.com
```

## Structures (API, Test, Env, Doc)

A compact field reference for each MMT type, so generators and AIs have one place to check shapes. See the dedicated docs for deeper explanations.

### API structure

Required top-level keys for HTTP/WS definitions.

```yaml
type: api                    # literal
title: string                # optional but recommended
tags: string[]               # optional
description: string          # optional
import: record<string,string># optional (alias -> path)
inputs: record<string, primitive>
outputs: record<string, string>
setenv: record<string, string>
protocol: http | ws          # required
method: get|post|put|delete|patch|head|options|trace   # HTTP only
format: json | xml | text    # affects body encoding
url: string                  # may include query string
headers: record<string,string>
query: record<string,string>
cookies: record<string,string>
body: object|string|null     # type depends on format
examples: Array<{
  name: string               # required
  description?: string
  inputs?: record<string, primitive>
}>
```

Example (HTTP):
```yaml
type: api
protocol: http
method: post
url: https://api.example.com/users
body:
  name: John
```

Example (WebSocket):
```yaml
type: api
protocol: ws
url: wss://ws.example.com/chat
inputs:
  greeting: "Hello, server!"
body: i:greeting
# Response handling occurs in test (use check/assert on returned payload)
```

Notes
- Dynamic tokens: `r:<name>`, `c:<name>`, `e:<VAR>` supported in url/headers/query/cookies/body/inputs
- Default headers are auto-added; set a header value to `_` to block (User-Agent, Content-Type, Content-Length, etc.)
- For WebSocket (`protocol: ws`): Treat as synchronous req-res; `body` is the sent message, response is the reply.
- Place inputs immediately after title/description for readability
- Skip empty maps/arrays unless the generator has a reason to include placeholders (empty blocks are optional per schema)
- Inputs SHOULD NOT list data types as literal strings (e.g., `name: string`). Instead they hold default/sample primitive values or dynamic tokens. Example: `name: r:firstName`, `email: r:email`. Use examples section to override input values per example.

See also: docs/api-mmt.md

### Test structure

Test flows that call APIs/tests and perform checks.

```yaml
type: test                   # literal
title: string
tags: string[]
description: string
import: record<string,string>   # alias -> path (CSV or .mmt)
inputs: record<string, primitive>
outputs: record<string, primitive>
metrics?: { repeat?: string|number, threads?: number, duration?: string, rampup?: string }
steps?: Step[]               # sequential when at root
stages?: Array<{            # optional staged/parallel model
  id: string
  name?: string
  steps: Step[]
  condition?: string
  dependencies?: string | string[]
}>
```

Where a Step is one of:
- call: { call: string, id?: string, inputs?: record<string, any> }
- check: string | { expr: string }
- assert: string | { expr: string }
- if: { if: string, steps: Step[], else?: Step[] }
- for: { for: string, steps: Step[] }
- repeat: { repeat: number|string, steps: Step[] }
- delay: number|string
- js: string
- print: string
- set | var | const | let: record<string, any>
- data: string

Example:
```yaml
type: test
title: User CRUD Test
steps:
  - call: create-user
    id: create
    inputs:
      name: "John"
  - assert: status == 201
  - check: response.id != null
  - assert: response.name == "John"
```

See also: docs/test-mmt.md

### Env structure

Global variables and optional presets.

```yaml
type: env                    # literal
variables: record<string, primitive | object (choices) | array (allowed)>
presets: record<string, record<string, record<string, primitive>>>
```

Example:
```yaml
type: env
variables:
  API_URL: https://api.example.com
  TOKEN: your-token
presets:
  dev:
    API_URL: http://localhost:3000
  prod:
    API_URL: https://prod.api.com
```

Usage
- Use `e:VAR` as a standalone token (type-preserving) or `<<e:VAR>>` inline in strings.
- Omit empty `presets`/`variables` entries when there is nothing to declare; blank sections are optional

See also: docs/environment-mmt.md

### Doc structure

Aggregate and render API docs from sources.

```yaml
type: doc                    # literal
title: string
sources: string[]            # folders or .mmt files
services?: Array<{
  name?: string
  description?: string
  sources?: string[]
}>
```