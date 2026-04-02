# Test

Use `type: test` to define a test MMT file. You can build complex flows with the elements below. Under the hood, Multimeter compiles your MMT to JavaScript and runs it inside VS Code or in CI with `testlight`.

Example:

```yaml
type: test
title: Login and get user info
tags:
  - smoke
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
      outputs.name: ${user_info.name}
      outputs.family: ${user_info.family}
```

For the provided MMT, the Test panel shows the generated JavaScript. Click Run to execute the test.
![Test panel](../screenshots/test_panel_test.png)

## Elements
The `test` type also supports documentation fields (title, tags, description) and reuse/compose elements (import, inputs, outputs). See the API doc for details. The sections below cover flow elements.

### import
The `import` section lets you bring in other `.mmt` files (APIs, tests, or CSVs) to use in your test. Each import has an alias (the key) and a file path (the value).

```yaml
import:
  login: login.mmt           # relative to current file
  users: ../data/users.csv   # relative path
  api: +/apis/userApi.mmt    # project root path
  helpers: ./helpers/xxx.js  # JS helper module (CommonJS)
```

**JS helper modules**
- Files ending in `.js`, `.cjs`, or `.mjs` are treated as JavaScript helper modules.
- They are loaded via the runner's `fileLoader` and evaluated once per run, then cached.
- Use CommonJS exports (recommended):

```js
// xxx.js
module.exports = {
  add(a, b) {
    return a + b;
  }
};
```

Then in your test steps:

```yaml
type: test
import:
  helpers: ./helpers/xxx.js
steps:
  - js: |
      const sum = helpers.add(1, 2)
      console.log('sum', sum)
```

**Path resolution:**
- **Relative paths** (e.g., `./login.mmt`, `../apis/users.mmt`) resolve relative to the current file's directory.
- **Project root paths** start with `+/` and resolve relative to the directory containing `multimeter.mmt`. This is useful for importing shared APIs or data from a central location without worrying about relative path depth.

**CSV import behavior:**
- CSV files are parsed following RFC 4180 (quoted fields, embedded commas).
- Unquoted numeric strings are auto-coerced to numbers (`"42"` → `42`).
- `true`/`false` are coerced to booleans.
- Quoted values remain strings (e.g., `"00123"` stays `"00123"`).
- BOM characters at the start of the file are handled automatically.

Example with project root imports:
```yaml
# File: tests/auth/login_test.mmt
type: test
import:
  auth_api: +/apis/auth.mmt      # resolves to <project>/apis/auth.mmt
  test_data: +/data/users.csv    # resolves to <project>/data/users.csv
  helper: ./helper.mmt           # resolves to tests/auth/helper.mmt
```

The project root is detected by walking up directories from the current file until `multimeter.mmt` is found. If no `multimeter.mmt` exists, `+/` paths will fail to resolve.

### Stages
Stages let you run groups of steps in parallel. All stages start concurrently; use `after` to control order. If you have a single linear flow, you can skip stages and place steps at the test root.

```yaml
stages:
  - id: login
    title: Login Stage
    steps:
      - call: login
        id: doLogin
  - id: profile
    after: login   # or
                          #   - login
                          #   - anotherStage
    steps:
      - call: getUser
        id: me
        inputs:
          token: ${doLogin.token}
```

### Steps
Steps are the building blocks of a test. When placed at the test root, they run sequentially. Inside stages, steps run within that stage; parallelism is controlled by the stages.
You can visualize and run the flow from the Flow panel; each step here corresponds to a UI block in that panel.

![Flow panel](../screenshots/test_panel_flow.png)

### call
Invoke an imported API or another test; give it an id to reference its outputs later. The `call` field must be the first key in the step.
```yaml
# call an API named login
- call: login
  id: doLogin
  inputs:
    username: i:user
    password: i:pass

# call another test named getUser
- call: getUser
  id: profile
  inputs:
    token: ${doLogin.token}
```

### run
Start an imported mock server. The server runs for the duration of the test and stops automatically when the test finishes.

```yaml
type: test
title: Test with Mock Server
import:
  mockApi: ./mocks/user-service.mmt   # type: server file
  userApi: ./apis/user.mmt
steps:
  - run: mockApi                       # starts the mock server
  - call: userApi
    id: getUsers
  - assert: ${getUsers.status} == 200
```

**Behavior:**
- If the server is already running, `run` does nothing (idempotent)
- All servers started by `run` stop automatically when the test finishes
- If the port is already in use, the test fails with an error

Use this to make tests self-contained — no need to manually start servers before running.

#### Inline expect on call

Use `expect` on a call step to validate its output parameters inline, without a separate `check`/`assert` step. Each key is an output field name; each value is the expected result. All expect entries in a single call are grouped into **one report item** in the report panel, with each individual comparison shown as a sub-item. Expect is non-throwing — it logs failures but continues execution.

**Fields:**

| Field     | Description |
|-----------|-------------|
| `call`    | (required) The import alias of the API or test to invoke |
| `id`      | Assign the call result to a variable for later reference |
| `title`   | Short summary shown inline in reports and UI |
| `inputs`  | Key-value pairs passed as input parameters to the called item |
| `expect`  | Map of output fields to expected values (non-throwing) |
| `report`  | Report level: `all`, `fails`, `none`, or object with `internal`/`external` |

**Formats:**

Simple equality (default operator is `==`):
```yaml
- call: login
  expect:
    status_code: 200
```

Explicit operator:
```yaml
- call: echo
  expect:
    status_code: == 200
    echoed_message: == <<i:message>>
```

Multiple checks on the same field (array form):
```yaml
- call: login
  expect:
    status_code:
      - == 200
      - != 500
```

Nested field access with dot-notation:
```yaml
- call: getUser
  expect:
    body.user.name: == John
    body.user.active: true
```

With title and report:
```yaml
- call: login
  title: Login validation
  expect:
    status_code: 200
    token: != null
  report:
    internal: all
    external: fails
```

All comparison operators supported by `check`/`assert` are available in `expect` values: `==`, `!=`, `<`, `>`, `<=`, `>=`, `=@`, `!@`, `=^`, `!^`, `=$`, `!$`, `=~`, `!~`.

### check, assert
Use check to log a failure and continue; use assert to stop the flow on failure.

Supported operators
- `<`, `>`, `<=`, `>=`, `==`, `!=`
- `=@` (right side contains left side, i.e., `expected.includes(actual)`)
- `!@` (right side does not contain left side)
- `=^` (starts with), `!^` (not starts with)
- `=$` (ends with), `!$` (not ends with)
- `=~` (regex match), `!~` (not regex match)

You can write checks and asserts in a concise inline form or in a structured object form with explicit `actual`, `expected`, `operator`, and an optional `title` or `details`.

Inline examples
```yaml
- assert: ${doLogin.status} == 200
- check: ${profile.name} =~ /John/i
```

> **Note:** Values referencing step ids, loop variables, or JS-scoped variables must use `${...}` to resolve at runtime:
> ```yaml
> - call: myApi
>   inputs:
>     name: ${row.name}         # resolves the loop variable
>     token: ${doLogin.token}   # resolves a step id output
>   check:
>     - ${result.name} == ${row.expected_name}
> ```
> Without `${...}`, the text is treated as a literal string (e.g. `name: row.name` sends the text "row.name").

Object-form examples
```yaml
- check:
    actual: ${profile.name}
    expected: "John"
    operator: "=="
    title: "Profile name check"
    details: "Profile name must be John"

- assert:
    actual: ${doLogin.status}
    expected: 200
    operator: "=="
    title: "Login status"
    details: "Login must succeed"
```

#### Report configuration
The `report` field controls when check/assert results are emitted. This is useful when tests are imported or added to suites.

Values:
- `all` — report both passes and failures
- `fails` — report only failures (default for external)
- `none` — silent, no reporting

Shorthand (applies to both internal and external runs):
```yaml
- check:
    actual: status
    expected: 200
    report: all
```

Object form (different levels for direct vs imported/suite runs):
```yaml
- check:
    actual: status
    expected: 200
    report:
      internal: all   # when running this test directly
      external: fails # when imported or added to a suite
```

Default behavior (if `report` is omitted):
- `internal: all` — report all results when running directly
- `external: fails` — report only failures when imported or in a suite

Checks, assertions, prints, and errors appear in the Log panel while the flow runs. The report level also determines the [log level](./logging.md#checks-and-asserts) for each result.

![Log panel](../screenshots/test_panel_log.png)

### if, else
Conditionally run nested steps based on an expression.
```yaml
- if: ${doLogin.status} == 200
  steps:
    - call: getUser
      id: me
  else:
    - print: "Login failed"
```

### for, repeat
`for` runs with a JavaScript-style header (for example, `const user of users`) and executes the inner steps per item. `repeat` runs the inner steps a fixed number of times, time-based, or indefinitely.

The `for` expression is passed directly to JavaScript, so any valid JS for-of/for-in/for header works:
```yaml
# iterate imported CSV rows (from import:
#   users: ./users.csv)
- for: const user of users
  steps:
    - call: login
      id: login1
      inputs:
        username: ${user.username}
        password: ${user.password}

# iterate with index
- for: let i = 0; i < 10; i++
  steps:
    - print: "iteration ${i}"

# iterate object entries
- for: const [key, value] of Object.entries(config)
  steps:
    - print: "${key} = ${value}"
```

`repeat` supports count-based, time-based, and infinite modes:
```yaml
# repeat N times
- repeat: 3
  steps:
    - call: poll
    - delay: 2s

# repeat for a duration
- repeat: 30s
  steps:
    - call: healthCheck

# other time units: ms, s, m, h
- repeat: 5m
  steps:
    - call: poll

# repeat indefinitely (until manually stopped)
- repeat: inf
  steps:
    - call: monitor
    - delay: 1s
```

### delay
Pause the flow for a duration.
```yaml
- delay: 500    # ms
- delay: 2s     # units: ns|ms|s|m|h
```

### js
Run inline JavaScript for custom logic or logging.
```yaml
- js: |
    const t = Date.now();
    console.log('ts', t);
```

The following globals are available inside `js` steps:

| Global | Description |
|--------|-------------|
| `console` | Custom console with `log`, `warn`, `error`, `debug`, `trace` |
| `send_(request)` | Send an HTTP request directly |
| `extractOutputs_(response, outputMap)` | Extract values from a response |
| `report_(stepType, comparison, title, details, passed)` | Emit a check/assert result to the log |
| `setenv_(name, value)` | Set an environment variable at runtime |
| `importJsModule_(path)` | Load a JS module at runtime |
| `Random.*` | All random token functions (e.g., `Random.randomUUID()`, `Random.randomInt()`, `Random.randomEmail()`) |
| `__mmt_random(name)` | Resolve a random token by name (e.g., `__mmt_random('uuid')`) |
| `__mmt_current(name)` | Resolve a current token by name (e.g., `__mmt_current('date')`) |
| `equals_()`, `less_()`, `greater_()`, etc. | Comparison helpers matching check/assert operators |

### print
Write a message to the log output.
```yaml
- print: "Starting flow"
```

### set, var, const, or let
Create or change variables for later steps. `set` mutates existing (or creates new); `var`/`const`/`let` follow JS scoping.

```yaml
- set:
    token: ${doLogin.token}   # mutable

- var:
    attempt: 1

- const:
    role: "admin"

- let:
    note: "temp"
```

When to use which:
- **set**: creates or updates a variable in the current scope (mutable). Use for values that change across steps.
- **var**: function-scoped variable (hoisted). Rarely needed; prefer `let`.
- **const**: block-scoped, cannot be reassigned. Use for values that shouldn't change.
- **let**: block-scoped, can be reassigned. Use for loop counters or temporary values.

### setenv
Set environment variables during a run. This is mainly useful when you run a test directly (not as an imported sub-test), because it updates the runtime environment for subsequent calls.

```yaml
- setenv:
    TOKEN: "${doLogin.token}"
    USER_ID: "${me.id}"
```

Notes:
- Values can be strings (template strings supported) or non-string literals.
- When running a suite, setenv events are still emitted but may be scoped to the top-level run behavior.

### data
Bind an imported CSV alias (from the test's import section) into scope for use in loops and steps.
```yaml
- data: users   # where import:
                #   users: ./users.csv
```

## Stage condition
Stages support a `condition` field that skips the stage if the condition evaluates to false. The condition uses the same syntax as `assert`/`check` inline expressions.

```yaml
stages:
  - id: login
    steps:
      - call: login
        id: doLogin
  - id: profile
    condition: ${doLogin.status} == 200
    after: login
    steps:
      - call: getProfile
```

## Complete example
```yaml
type: test
title: Login + Profile
import:
  users: ./users.csv
inputs:
  user: string
  pass: string
steps:
  - call: login
    id: doLogin
    inputs:
      username: i:user
      password: i:pass
  - assert: ${doLogin.status} == 200
  - set:
      token: ${doLogin.token}
  - delay: 2s
  - call: getUser
    id: me
    inputs:
      token: ${token}
  - check: ${me.email} =~ /@example.com$/
```

## Reference (types)
- type: `test`
- title: string
- tags: string[]
- description: string (supports Markdown; use `|-` for multiline)
- import: record&lt;string, string&gt; (`.mmt`, `.csv`, `.js`/`.cjs`/`.mjs`)
- inputs: record&lt;string, string | number | boolean | null&gt;
- outputs: record&lt;string, string | number | boolean | null&gt;
- steps: array of step (alias: `flow`)
- stages: array of { id, title?, steps, condition?, after? }
- step types: `call`, `check`, `assert`, `if`, `for`, `repeat`, `delay`, `js`, `print`, `set`, `var`, `const`, `let`, `setenv`, `data`

Notes:
- `flow` is accepted as a backward-compatible alias for `steps`.
- The YAML editor provides autocomplete for `call` step names, check/assert operators, and input references.

---

## See also
- [API](./api-mmt.md) — define HTTP/WS requests that tests call
- [Environment](./environment-mmt.md) — variables and presets consumed by tests
- [Suite](./suite-mmt.md) — group and run multiple tests together
- [Mock Server](./mock-server.md) — use `run` step to start servers in tests; define `type: server` files
- [Testlight CLI](./testlight.md) — run tests from the command line
- [Reports](./reports.md) — generate test reports (JUnit XML, HTML, Markdown, MMT YAML)
- [Certificates](./certificates-mmt.md) — SSL/TLS and mTLS configuration
- [Logging](./logging.md) — log levels for checks, prints, and network calls
- [Sample Project](./sample-project.md) — full walkthrough with APIs, tests, suites, and docs
