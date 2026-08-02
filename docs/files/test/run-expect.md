# Inline expect and debug

Use `expect` on a [`call`](./call.md) step to validate its output parameters inline, without a separate `check`/`assert` step. Each key is an output field name; each value is the expected result. All expect entries in a single call are grouped into **one report item**, with each comparison as a sub-item. Expect is non-throwing — it logs failures but continues execution.

**Call fields related to expect:**

| Field     | Description |
|-----------|-------------|
| `call`    | (required) The import alias of the API or test to invoke |
| `id`      | Assign the call result to a variable for later reference |
| `title`   | Short summary shown inline in reports and UI |
| `inputs`  | Key-value pairs passed as input parameters |
| `expect`  | Map of output fields to expected values (non-throwing) |
| `debug`   | Like `expect`, but for debugging — logs/report only, excluded from exports |
| `report`  | Report level: `all`, `fails`, `none`, or object with `internal`/`external` |

**Formats:**

```yaml
# Simple equality (default operator is ==)
- call: login
  expect:
    status_code: 200

# Explicit operator
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

All comparison operators from [`check`/`assert`](./assert-operators.md) are available in `expect` values.

`omit` behavior:
- Use unquoted `omit` when you expect a field to be missing.
- `null` = field exists with null value; `omit` = field/path does not exist.

```yaml
- call: getUser
  expect:
    body.user.middle_name: omit
    body.user.first_name: != omit
```

#### Inline debug

`debug` uses the same syntax and operators as `expect`, but results show a **debug icon** and are **not included in exported reports**.

```yaml
- call: login
  expect:
    status_code: 200
  debug:
    body.token: != null
    body.expires_in: > 0
```

See also: [run](./run.md) · [assert](./assert.md) · [Assert operators](./assert-operators.md)
