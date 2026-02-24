# MMT Overview

A quick tour of Multimeter `.mmt` YAML types: api, test, and env—what each is for, how they relate, and where to go deeper.

For full details, see the references:
- [API](./api-mmt.md)
- [Test](./test-mmt.md)
- [Environment](./environment-mmt.md)
- [Doc](./doc-mmt.md)
- [Suite](./suite-mmt.md)
- [Testlight CLI](./testlight.md)
- [Mock Server](./mock-server.md)
- [Convertor](./convertor.md)
- [Certificates](./certificates-mmt.md)
- [Changelog](../CHANGELOG.md)

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
  API_URL:
    dev: http://localhost:8080
    prod: https://api.example.com
  test_type: 
    - smoke
    - regression
presets:
  runner:
    dev: 
      API_URL: dev
      test_type: smoke
    ci:  
      API_URL: prod
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
- The JS that runs is generated automatically from your YAML.

## Connections panel
The Connections panel shows active HTTP keep-alive and WebSocket connections with lifecycle states (`connecting`, `open`, `idle`, `closing`). You can close connections manually from this panel.

## Project root (`multimeter.mmt`)
Place a `multimeter.mmt` file (with `type: env`) at the root of your project to enable:
- Workspace environment auto-loading
- `+/` project root imports in tests, APIs, and suites

See [Environment — Project Root Marker](./environment-mmt.md#project-root-marker) for details.