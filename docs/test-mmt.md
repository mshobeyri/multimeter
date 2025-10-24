# Test (Flows)

Usage-first guide for writing test `.mmt` files: steps, stages, metrics, inputs/outputs, and examples.

Supported tokens
- Environment: `e:VAR`, `<e:VAR>`, `<<e:VAR>>`
- Inputs: `<i:key>` (use inside url/headers/body)

## Example: YAML to auto-generated JS
The JS that runs is automatically generated from your YAML. You can generate and run it directly by clicking the Run button in the Test panel.

YAML
```yaml
type: test
title: login_and_get_user_info
tags: []
import:
  create_session: create_session.mmt
  get_user_info: get_user_info.mmt
inputs:
  login_username: milad@gmail.com
  user: hassan@gmail.com
outputs:
  name: mehrdad
  family: shobeyri
  age: 35
steps:
  - call: create_session
    id: login
    inputs:
      username: i:login_username
      password: 654321
  - call: get_user_info
    id: user_info
    inputs:
      username: mahmood@gmail.com
      password: 123456
      session: ${login.session}
      user: i:user
  - set:
      outputs.name: user_info.name
      outputs.family: user_info.family
```

Test panel (click Run to execute):

![Test panel](../screenshots/test_panel_test.png)

## Define a test
```yaml
 type: test
 title: Login and fetch profile
 tags: [auth]
 description: Validate login flow then load user profile
 import:
   users: ./users.csv      # CSV alias
 inputs:
   user: string
   pass: string
 outputs:
   token: string
 metrics:
   repeat: "3"            # or a number; can combine with threads/duration
   threads: 2
   duration: 30s
   rampup: 5s
 steps: []                 # or use stages: []
```

Create and inspect tests from the Test panel in the UI; fields map directly to the YAML shown above.

## Steps (building blocks)

You can visualize and run the flow from the Flow panel; each step here corresponds to a UI block in that panel.

![Flow panel](../screenshots/test_panel_flow.png)

### call (invoke API or Test)
- Call a named API or another test; give it an `id` to reference later.
```yaml
# call an API named login
- call: login
  id: doLogin
  inputs:
    username: <i:user>
    password: <i:pass>

# call another test named getUser
- call: getUser
  id: profile
  inputs:
  token: doLogin.token
```

### check and assert
- `check`: logs a failure but continues
- `assert`: throws on failure and stops the flow

Supported operators
- `<`, `>`, `<=`, `>=`, `==`, `!=`, `=@` (contains), `!@` (not contains), `=^` (starts with), `!^` (not starts with), `=$` (ends with), `!$` (not ends with), `=~` (regex), `!~` (not regex)

Examples
```yaml
- assert: doLogin.status == 200
- check: profile.name =~ /John/i
```

Checks, assertions, prints, and errors appear in the Log panel while the flow runs.

![Log panel](../screenshots/test_panel_log.png)

### if / else (conditions)
```yaml
- if: doLogin.status == 200
  steps:
    - call: getUser
      id: me
  else:
    - print: "Login failed"
```

### for / repeat (loops)
```yaml
# iterate imported CSV rows (from import: { users: ./users.csv })
- for: const user of users
  steps:
    - call: login
      id: login1
      inputs: { username: user.username, password: user.password }

# repeat N times (or "inf")
- repeat: 3
  steps:
    - call: poll
    - delay: 2s
```

### delay
```yaml
- delay: 500    # ms
- delay: 2s     # units: ns|ms|s|m|h
```

### js
```yaml
- js: |
    const t = Date.now();
    console.log('ts', t);
```

### print
```yaml
- print: "Starting flow"
```

### set / var / const / let (variables)
```yaml
- set: { token: doLogin.token }   # mutable
- var: { attempt: 1 }
- const: { role: "admin" }
- let: { note: "temp" }
```

### data (bind imported CSV)
```yaml
- data: users   # where import: { users: ./users.csv }
```

## Stages (grouping and dependencies)
```yaml
stages:
  - id: login
    name: Login Stage
    steps:
      - call: login
        id: doLogin
  - id: profile
    dependencies: login   # or [login, anotherStage]
  condition: doLogin.status == 200  # optional
    steps:
      - call: getUser
        id: me
    inputs: { token: doLogin.token }
```

## Metrics (simple load controls)
```yaml
metrics:
  repeat: "100"   # or number or "inf"
  threads: 5
  duration: 60s
  rampup: 10s
```

## Inputs and outputs (test level)
- Declare inputs you expect to receive and outputs you plan to produce at the test level.
```yaml
inputs:
  user: string
  pass: string
outputs:
  token: string
```
Use `<i:key>` inside steps to substitute test inputs:
```yaml
- call: login
  id: doLogin
  inputs: { username: <i:user>, password: <i:pass> }
```

## Complete example
```yaml
 type: test
 title: Login + Profile
 import: { users: ./users.csv }
 inputs: { user: string, pass: string }
 steps:
  - call: login
    id: doLogin
    inputs: { username: <i:user>, password: <i:pass> }
  - assert: doLogin.status == 200
  - set: { token: doLogin.token }
  - delay: 2s
  - call: getUser
    id: me
    inputs: { token: token }
  - check: me.email =~ /@example.com$/
```

## Reference (types)
- type: `test`
- title: string
- tags: string[]
- description: string
- import: record<string,string> (CSV)
- inputs: record<string, string|number|boolean|null>
- outputs: record<string, string|number|boolean|null>
- metrics: { repeat?: string|number, threads?: number, duration?: Timestr, rampup?: Timestr }
- steps: array of step
- stages: array of { id, name?, steps, condition?, dependencies? }
- step types: `call`, `check`, `assert`, `if`, `for`, `repeat`, `delay`, `js`, `print`, `set`, `var`, `const`, `let`, `data`
