This file tells the AI how to generate **`type: test`** `.mmt` files.

Always follow these rules:
- Output must be valid YAML.
- The first non-comment line must be `type: test`.
- Tests should primarily **call APIs or other tests**, assert results, and optionally loop or branch.

---

## Schema (mental model for the AI)

These fields match `TestData` in `core/src/TestData.ts` and the public docs in `docs/test-mmt.md`.

Top-level keys and types:

```yaml
type: test                      # REQUIRED, must be exactly "test"

title: string                   # REQUIRED, human-readable test name
tags:                           # REQUIRED (can be empty array) for grouping
  - string

description: string             # optional, short explanation

import:                         # alias -> file path (apis, tests, CSV)
  <alias>: path/to/file.mmt

inputs:                         # input variables with default values
  <name>: string                # or number/boolean/null (JSON-compatible)

outputs:                        # top-level outputs for this test
  <name>: string                # expression or literal

metrics:                        # optional performance/load hints
  repeat?: string | number      # e.g. "10" or "inf"
  threads?: number
  duration?: string             # "10s", "1m", "2h", "inf"
  rampup?: string               # same units as duration

steps:                          # linear flow of steps (no stages)
  - <step>

stages:                         # parallel/grouped flows
  - id: string
    title?: string
    condition?: string          # optional condition string
    after?: string | string[]
    steps:                      # steps inside this stage
      - <step>
```

`steps` and `stages` are mutually exclusive in typical usage — use **one** or the other unless you have a very deliberate reason.

---

## Step types

All steps are objects with a `type` (implicit from the key). They map to `TestFlowStep` in `TestData.ts`.

Supported step forms:

```yaml
# 1) call: invoke another test or an API (imported by alias)
- call: <alias>
  id: <stepId>                  # REQUIRED, used to reference outputs later
  title?: string                # optional human-readable label
  inputs?:                      # passed as JSON object
    <name>: <value>
  expect?:                      # inline assertions (shorthand for assert)
    <field>: <value>
  debug?:                       # inline debug inspections (same syntax as expect, never fails)
    <field>: <value>
  report?: all | fails | none   # controls reporting level

# 2) run: start an imported mock server (type: server file)
- run: <alias>                  # alias of an imported server file

# 3) check: soft assertion (logs failure, continues)
- check: <comparison>

# 4) assert: hard assertion (stops on failure)
- assert: <comparison>

# 5) if: conditional block
- if: <comparison>
  steps:
    - <step>
  else?:
    - <step>

# 6) repeat: repeat a block N times or by string
- repeat: <number | string>
  steps:
    - <step>

# 7) for: loop header (JS-style or shorthand)
- for: <header or expression>
  steps:
    - <step>

# 8) js: inline JavaScript
- js: |
    // javascript code

# 9) print: log a message
- print: "text"

# 10) delay: sleep
- delay: <number | string>      # e.g. 200, "2s", "1m"

# 11) set: assign/update variables
- set:
    <name>: <value>

# 12) var / const / let: JS-style declarations
- var:
    <name>: <value>
- const:
    <name>: <value>
- let:
    <name>: <value>

# 13) data: bind CSV alias (from import)
- data: <alias>

# 14) setenv: promote values into environment variables
- setenv:
    <env_name>: <value>       # e.g. token: ${loginStep.token}
```

### Additional `call` fields

Beyond the basic `call`, `id`, and `inputs`, a call step also supports:

```yaml
- call: <alias>
  id: <stepId>
  title?: string              # optional human-readable label for logs/reports
  inputs?: { ... }
  expect?:                    # inline assertions on the call result
    <field>: <value>          # e.g. status: 200, body.name: "John"
  debug?:                     # inline debug inspections (same syntax as expect, never fails)
    <field>: <value>          # e.g. status: 200, body: ${someVar}
  report?: all | fails | none # controls pass/fail reporting level
```

`expect` is a shorthand for common assertions — each key is a dotted path into the response, and the value is compared with `==` by default. You can prefix with an operator (e.g. `>= 1`, `!= null`).

`debug` uses the same syntax as `expect` but never fails the test — it always logs results with a debug icon for troubleshooting. Debug entries are excluded from exported reports.

---

`<comparison>` is a string expression using operators from `opsList` in `TestData.ts`:

- `<`, `>`, `<=`, `>=`, `==`, `!=`
- `=@` (is at: actual is found within expected), `!@` (is not at)
- `=^` (starts with), `!^` (not starts with)
- `=$` (ends with), `!$` (not ends with)
- `=~` (regex match), `!~` (regex not match)

Example comparisons:

```yaml
- assert: ${login.status} == 200
- check: ${profile.email} =~ /@example.com$/
- assert: ${response.body.total} >= 1
```

---

## Naming and references

- Every `call` step **must** have a unique `id` within the test.
- Use that `id` to reference its outputs in later steps (the exact JS shape comes from the imported file, but following patterns from the docs is enough):

```yaml
- call: login
  id: loginStep
  inputs:
    username: i:username
    password: i:password

- assert: ${loginStep.status} == 200
```

- Use `set` to place values into `outputs` if you want the test itself to expose results:

```yaml
- set:
    outputs.token: ${loginStep.token}
```

---

## Tokens the AI can use in tests

You can use the same token syntaxes as for APIs:

- Environment variables: `e:api_url`, `e:auth_token`, etc., or `<<e:api_url>>`
- Test inputs: `i:user_id` or `<<i:user_id>>`
- Random values: `r:name` or `<<r:name>>`
- Current/time values: `c:name` or `<<c:name>>`

Guidelines:
- Use bare tokens when they are the **entire value**.
- Use `<< >>` when embedding in text.

Example:

```yaml
inputs:
  username: user@example.com
  password: string

steps:
  - call: login
    id: loginStep
    inputs:
      username: i:username
      password: i:password
  - assert: ${loginStep.status} == 200
  - set:
      outputs.token: ${loginStep.token}
```

---

## Common patterns the AI should generate

### 1. Simple smoke test for a single API

User asks: "Create a test that logs in and checks status 200. The API alias is `login`."

```yaml
type: test
title: Login smoke test
tags: [smoke, auth]
inputs:
  username: user@example.com
  password: string
steps:
  - call: login
    id: loginStep
    inputs:
      username: i:username
      password: i:password
  - assert: ${loginStep.status} == 200
```

### 2. Chained calls: login then get profile

```yaml
type: test
title: Login and get profile
tags: [smoke, auth, profile]
import:
  login: ./login.mmt
  get_profile: ./get_profile.mmt
inputs:
  username: user@example.com
  password: string
steps:
  - call: login
    id: loginStep
    inputs:
      username: i:username
      password: i:password
  - assert: ${loginStep.status} == 200

  - call: get_profile
    id: profileStep
    inputs:
      token: ${loginStep.token}
  - assert: ${profileStep.status} == 200
```

### 3. Data-driven loop over CSV

```yaml
type: test
title: Login for multiple users
tags: [load, auth]
import:
  users: ./users.csv
  login: ./login.mmt

steps:
  - data: users
  - for: const user of users
    steps:
      - call: login
        id: loginStep
        inputs:
          username: ${user.username}
          password: ${user.password}
      - check: ${loginStep.status} == 200
```

### 4. Conditional flows

```yaml
type: test
title: Conditional retry on failure
tags: [resilience]
import:
  login: ./login.mmt

steps:
  - call: login
    id: login1
  - if: ${login1.status} != 200
    steps:
      - print: "Retrying login"
      - call: login
        id: login2
      - assert: ${login2.status} == 200
    else:
      - print: "Login succeeded on first attempt"
```

---

## Style rules for the AI

- Use 2-space indentation.
- Prefer small, readable tests focused on a single behavior.
- Prefer `steps` for simple linear flows; only use `stages` when explicit parallelism is needed.
- Always include `title` and `tags` (even if tags is a small list like `[smoke]`).
- Avoid adding `js` steps unless the user needs custom logic that can’t be expressed with other constructs.- Do **not** add YAML comments (`#`). Multimeter's formatter removes them on reformat, so they will always be lost. Use `title` on steps or the top-level `description` field instead.
When unsure, generate a **minimal valid test** that clearly calls the described APIs and asserts the most important property (typically HTTP status or a key field in the response).
