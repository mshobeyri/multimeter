# call

Invoke an imported API, test, HTTP Client file, or Bruno request. The `call` field must be the first key in the step.

```yaml
import:
  login: login.mmt
  getUser: get_user.mmt

steps:
  - call: login
    id: doLogin
    title: Log in as test user
    inputs:
      username: i:user
      password: i:pass

  - call: getUser
    id: profile
    inputs:
      token: ${doLogin.token}
```

See [import](../import.md) for supported import types and path rules.

## Field reference

| Field | Required | Description |
|-------|----------|-------------|
| `call` | yes | Import **alias** from the file's `import:` section (not a file path). |
| `id` | no | Variable name for the call result. Use `${id.field}` in later steps. When `expect` or `debug` is set and `id` is omitted, Multimeter assigns an internal name (for example `_login_0`). |
| `title` | no | Label in reports and the Flow view. Defaults to the imported file's title, then the alias, then `id`. |
| `inputs` | no | Key-value map passed to the callee's `inputs:`. Values support tokens (`i:`, `e:`, `r:`, `c:`), `${...}` expressions, and literals. |
| `expect` | no | Inline output validation on this step. Non-throwing — failures are reported but execution continues. Uses the same [operators](./check.md#operators) as `check`. See [expect formats](#expect) below. |
| `debug` | no | Same syntax as `expect`, but rows show a debug icon and are excluded from exported reports. Set `debug: true` to dump all top-level output keys. |
| `report` | no | Controls when `expect` results are emitted: `all`, `fails`, `none`, or `{ internal, external }`. Default: `internal: all`, `external: fails`. See [check — Report configuration](./check.md#report-configuration). |

## `inputs`

Pass runtime values into the called file's declared `inputs:`

```yaml
- call: login
  id: doLogin
  inputs:
    username: i:user
    password: i:pass
    token: ${previousStep.token}
```

Pass unquoted `omit` to drop a field from the request the called API builds — the field is removed instead of being sent with a value. Use `"omit"` (quoted) to send the literal string:

```yaml
- call: echo
  id: result
  inputs:
    message: omit
```

Values that reference step ids, loop variables, or JS-scoped variables must use `${...}`:

```yaml
- call: myApi
  inputs:
    name: ${row.name}
    token: ${doLogin.token}
```

Without `${...}`, the text is treated as a literal string (for example `name: row.name` sends the text `row.name`).

## Referencing outputs

After a call with `id: doLogin`, the result is a **high-scope variable** in the generated test. Later steps (including other stages with `after`, and steps after `if` / `for` / `repeat`) can read it with `${doLogin.status}`:

```yaml
- check: ${doLogin.status} == 200
- assert: ${doLogin.token} != omit
```

Output paths follow the same rules as API outputs (`status`, `body`, `headers`, `cookies`, `duration`, nested paths like `body.user.name`). See [Outputs](../../api/outputs.md).

## `expect`

`expect` validates callee outputs on the same step without a separate `check`. Each key is an output field name; each value is an expected result. All entries in one `expect` block are grouped into **one report row**, with each comparison as a sub-item.

```yaml
# Default equality (operator ==)
- call: login
  id: doLogin
  expect:
    status_code: 200

# Explicit operator — all operators from check are supported
- call: echo
  expect:
    status_code: == 200
    echoed_message: == <<i:message>>

# Multiple checks on the same field
- call: login
  expect:
    status_code:
      - == 200
      - != 500

# Nested field access
- call: getUser
  expect:
    body.user.name: == John
    body.user.active: true

# With title and report
- call: login
  title: Login validation
  expect:
    status_code: 200
    token: != null
  report:
    internal: all
    external: fails
```

Operator reference: [check — Operators](./check.md#operators).

`omit` in `expect:`
- Unquoted `omit` — field/path is missing.
- `null` — field exists with a null value.
- `!= omit` — field is present.

```yaml
- call: getUser
  expect:
    body.user.middle_name: omit
    body.user.first_name: != omit
```

For more expect/debug examples, see [Inline expect and debug](./run-expect.md).

## `debug`

`debug` uses the same syntax and operators as `expect`:

```yaml
- call: login
  id: doLogin
  expect:
    status_code: 200
  debug:
    body.token: != null
    body.expires_in: > 0
```

Set `debug: true` to log every top-level output key without writing individual comparisons.

## Cache

Caching is configured on the **imported test file** (`cache:` at test root), not on the call step. When a cached test is called again in the same root run with the same title and inputs, Multimeter reuses the previous outputs. Caller `expect` / `check` / `assert` still run. See [cache](../cache.md).

Example: [Imports — API and nested test calls](../../../../examples/intermediate/06_imports/README.md)

---

See also: [check](./check.md) · [assert](./assert.md) · [Inline expect](./run-expect.md) · [import](../import.md)
