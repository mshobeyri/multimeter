# Inline expect, require, and debug

Use `expect` / `require` on a [`call`](./steps/call.md) or [`http`](./steps/http.md) step to validate outputs inline, without a separate `check`/`assert` step. Each key is an output field name; each value is the expected result. Soft (`expect`) and hard (`require`) entries on the same call share **one report item**.

| Block | On failure |
|-------|------------|
| `expect` | Log and report; **continue** (like [check](./steps/check.md)) |
| `require` | Log and report; **stop** (like [assert](./steps/assert.md)) |

Full `call` field reference: [call](./steps/call.md).

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

All comparison operators from [Operators](./operators.md) are available in `expect` / `require` values. Missing fields use [omit](./omit.md). Report levels (`all` / `fails` / `none`): [Reports — Report levels](./reports.md#report-levels-all-fails-none).

#### Inline debug

`debug` uses the same syntax and [operators](./operators.md) as `expect`, but results show a **debug icon** and are **not included in exported reports**.

```yaml
- call: login
  expect:
    status_code: 200
  debug:
    body.token: != null
    body.expires_in: > 0
```

See also: [Operators](./operators.md) · [omit](./omit.md) · [call](./steps/call.md) · [check](./steps/check.md) · [run](./steps/run.md) · [Reports](./reports.md#report-levels-all-fails-none)
