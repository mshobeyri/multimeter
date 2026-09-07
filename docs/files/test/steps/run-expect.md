# Inline expect, require, and debug

Use `expect` / `require` on a [`call`](./call.md) or [`http`](./http.md) step to validate outputs inline, without a separate `check`/`assert` step. Each key is an output field name; each value is the expected result. Soft (`expect`) and hard (`require`) entries on the same call share **one report item**.

| Block | On failure |
|-------|------------|
| `expect` | Log and report; **continue** (like [check](./check.md)) |
| `require` | Log and report; **stop** (like [assert](./assert.md)) |

Full `call` field reference: [call](./call.md).

**Formats:**

```yaml
# Soft
- call: login
  expect:
    status_code: 200

# Hard
- call: login
  require:
    token: != null

# Soft + hard (one report box)
- call: login
  expect:
    status_code: 200
  require:
    token: != null
```

Expected sides follow the same YAML typing as `if` / `check`: unquoted `200` / `true` / `null` are number / bool / null; quote to force a string (`== "200"`).

```yaml
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

All comparison operators from [check — Operators](./check.md#operators) are available in `expect` values.

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

See also: [call](./call.md) · [check](./check.md) · [run](./run.md)
