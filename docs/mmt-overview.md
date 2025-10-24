# MMT Overview

A quick tour of Multimeter `.mmt` YAML types: api, test, and env—what each is for, how they relate, and where to go deeper.

For full details, see the references:
- [API YAML Reference](./api-mmt.md)
- [Test YAML Reference](./test-mmt.md)
- [Environment YAML Reference](./environment-mmt.md)

## Tokens at a glance
- Environment: e:VAR, <e:VAR>, <<e:VAR>>
- Inputs: <i:key>

## API (type: api)
Purpose: Define a single HTTP/WS request with inputs, headers, body, and extraction rules.

Minimal example
```yaml
type: api
protocol: http
url: <e:API_URL>/login
method: post
format: json
headers: { 'content-type': application/json }
body:
  username: <i:user>
  password: <i:pass>
# Capture values from the response
extract:
  token: $[body][token]
```
Use from Tests: tests import APIs and call them with inputs.

Deep dive: see [API YAML Reference](./api-mmt.md).

## Test (type: test)
Purpose: Orchestrate flows using steps/stages; call APIs/tests, assert, loop, and set outputs.

Minimal example
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
    inputs: { user: <i:user>, pass: <i:pass> }
  - assert: doLogin.status == 200
  - set: { token: doLogin.token }
```
UI: The flow is editable/visible in the Flow and Test panels; logs appear in Log.
Run: Click Run in the Test panel or use CLI (testlight run ...).

Deep dive: see [Test YAML Reference](./test-mmt.md).

## Environment (type: env)
Purpose: Centralize variables and presets; select per runner/preset and override via CLI.

Minimal example
```yaml
type: env
variables:
  API_URL:
    dev: http://localhost:8080
    prod: https://api.example.com
  test_type: [smoke, regression]
presets:
  runner:
    dev: { API_URL: dev, test_type: smoke }
    ci:  { API_URL: prod, test_type: regression }
```
UI: Edit variables/presets in the Environment and Environment Variables panels (Reset/Clear to apply or clean).
CLI: --env-file env.mmt --preset runner.dev, plus -e KEY=VAL overrides.

Deep dive: see [Environment YAML Reference](./environment-mmt.md).

## How they fit together
- Tests import APIs and data; Environments supply variables consumed by both.
- Inputs (<i:key>) are test-provided; Envs (e:VAR) come from env files/UI.
- The JS that runs is generated automatically from your YAML.

## Links
- API YAML Reference: ./api-mmt.md
- Test YAML Reference: ./test-mmt.md
- Environment YAML Reference: ./environment-mmt.md
