# MMT Overview

A quick tour of Multimeter `.mmt` YAML file types and VS Code features — what each is for, how they relate, and where to go deeper.

Multimeter uses YAML-based `.mmt` files with a `type` field at the top. The `type` determines what the file does:

| Type | Purpose | Documentation |
|------|---------|---------------|
| `api` | Define a single HTTP/WebSocket request | [API](./api-mmt.md) |
| `test` | Orchestrate flows with steps, assertions, loops | [Test](./test-mmt.md) |
| `env` | Variables, presets, and certificate config | [Environment](./environment-mmt.md) |
| `doc` | Generate API documentation from `.mmt` files | [Doc](./doc-mmt.md) |
| `suite` | Group and run multiple tests/APIs/suites | [Suite](./suite-mmt.md) |
| `server` | Define mock server endpoints with routing | [Mock Server Files](./mock-server.md#mmt-mock-server-files) |
| `report` | Structured test results (generated, viewable) | [Reports](./reports.md) |

For full details, see the references:
- **MMT File Types:** [API](./api-mmt.md) · [Test](./test-mmt.md) · [Environment](./environment-mmt.md) · [Doc](./doc-mmt.md) · [Suite](./suite-mmt.md) · [Mock Server Files](./mock-server.md#mmt-mock-server-files) · [Reports](./reports.md)
- **VS Code Panels:** [Mock Server Panel](./mock-server.md) · [Convertor](./convertor.md) · [History](./history.md) · [Certificates](./certificates-mmt.md)
- **Running & CI/CD:** [Testlight CLI](./testlight.md) · [Reports](./reports.md) · [Logging](./logging.md)
- [Sample Project](./sample-project.md) · [Changelog](../CHANGELOG.md)

## API (type: api)
Purpose: Define a single HTTP/WS request with inputs, headers, body, and extraction rules.

Minimal example
```yaml
type: api
protocol: http
url: https://abc.com/login
method: post
format: json
headers:
  content-type: application/json
body:
  username: mehrdad
  password: 123456
# Capture values from the response
outputs:
  token: body[token]
```
Use from Tests: tests import APIs and call them with inputs.

Deep dive: see [API](./api-mmt.md).

## Test (type: test)
Purpose: Orchestrate flows using steps/stages; call APIs/tests, assert, loop, and set outputs.

Minimal example for calling login and making sure the response is correct.
```yaml
type: test
title: Login flow
import:
  login: ./api/login.mmt
inputs:
  user: string
  pass: string
steps:
  - call: login
    id: doLogin
    inputs: 
      user: i:user
      pass: i:pass
  - assert: doLogin.status == 200
  - set:
      token: doLogin.token
```
UI: The flow is editable/visible in the Flow and Test panels; logs appear in Log.
Run: Click Run in the Test panel or use CLI (testlight run ...).

Deep dive: see [Test](./test-mmt.md).

## Environment (type: env)
Purpose: Centralize variables and presets.

Minimal example
```yaml
type: env
variables:
  api_url:
    dev: http://localhost:8080
    prod: https://api.example.com
  test_type: 
    - smoke
    - regression
presets:
  runner:
    dev: 
      api_url: dev
      test_type: smoke
    ci:  
      api_url: prod
      test_type: regression
```
Here we defined two URLs "dev" and "prod" to switch target machines easily. Also a variable called test type to filter some tests, for example. In the presets section we defined two presets as environments that can modify both variables with just one click.

Variables are accessible in all YAML files by `<<e:NAME>>` and, when used as a value after `: ` (colon + space), by `e:NAME`.

Deep dive: see [Environment](./environment-mmt.md).

## Doc (type: doc)
Purpose: Create aggregated, browsable documentation from your `.mmt` API files.

Minimal example
```yaml
type: doc
title: My APIs
sources:
  - ./apis
```
UI: Renders a searchable HTML page of all referenced APIs in the editor.

Deep dive: see [Doc](./doc-mmt.md).

## Suite (type: suite)
Purpose: Group and run multiple tests, APIs, or other suites, with control over sequential and parallel execution.

Minimal example
```yaml
type: suite
title: Smoke Tests
tests:
  - ./tests/login.mmt
  - ./tests/get_user.mmt
  - then
  - ./tests/logout.mmt
```
Run: Executes the items in stages. All items before a `then` run in parallel. The stages are run sequentially.

Deep dive: see [Suite](./suite-mmt.md).

## How they fit together
- Tests import APIs and data; Environments supply variables consumed by both.
- Inputs (`<<i:key>>`) are test-provided; Envs (`e:VAR`) come from env files/UI.
- Suites group tests and APIs into staged execution plans.
- Mock server files (`type: server`) can be started from tests (via `run` step) or suites.
- Reports are generated after test/suite runs and can be viewed in the editor or consumed by CI/CD tools.
- The JS that runs is generated automatically from your YAML.

## Mock Server File (type: server)
Purpose: Define mock endpoints with path routing, request matching, dynamic responses, and proxy forwarding — all in a YAML file.

Minimal example
```yaml
type: server
title: User Service Mock
port: 8081
cors: true

endpoints:
  - method: get
    path: /health
    status: 200
    body: OK

  - method: get
    path: /users/:id
    status: 200
    format: json
    body:
      id: ":id"
      name: Test User
```
Run: Start from the Mock Server panel, from a test using the `run` step, or include in a suite.

Deep dive: see [Mock Server](./mock-server.md#mmt-mock-server-files).

## Report (type: report)
Purpose: Structured test results generated after running tests or suites. Opening a `type: report` file in VS Code renders a visual summary with pass/fail counts, durations, and failure details.

```yaml
type: report
name: suite.mmt
timestamp: "2026-03-06T10:30:00.000Z"
duration: 1.234s
summary:
  tests: 4
  passed: 3
  failed: 1
  errors: 0
  skipped: 0
```

Reports can also be exported as JUnit XML, HTML, or Markdown for CI/CD integration.

Deep dive: see [Reports](./reports.md).

---

## VS Code Panels & Features

Beyond `.mmt` file types, Multimeter provides VS Code panels for common workflows:

### Mock Server Panel
Start HTTP, HTTPS, or WebSocket mock servers directly from the sidebar. The panel offers quick modes (reflect, custom status) and supports loading `type: server` files for full routing.

See [Mock Server](./mock-server.md).

### Convertor Panel
Import OpenAPI 3.x specs or Postman v2 collections and generate `.mmt` API files. Useful for bootstrapping a project from an existing API definition.

See [Convertor](./convertor.md).

### History Panel
Browse recent HTTP requests and responses made from the editor. Inspect method, URL, status, headers, body, and timing for each entry.

See [History](./history.md).

### Certificates Panel
Configure SSL/TLS settings, CA certificates, and client certificates (mTLS) for your workspace. Certificate file paths are stored in your env file for version control.

See [Certificates](./certificates-mmt.md).

### Connections Panel
The Connections panel shows active HTTP keep-alive and WebSocket connections with lifecycle states (`connecting`, `open`, `idle`, `closing`). You can close connections manually from this panel.

## Project root (`multimeter.mmt`)
Place a `multimeter.mmt` file (with `type: env`) at the root of your project to enable:
- Workspace environment auto-loading
- `+/` project root imports in tests, APIs, and suites

See [Environment — Project Root Marker](./environment-mmt.md#project-root-marker) for details.

For a hands-on walkthrough covering all features end-to-end, see [Sample Project](./sample-project.md).