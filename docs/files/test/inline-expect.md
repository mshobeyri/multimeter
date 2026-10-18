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

Expected sides follow the same YAML typing as `if` / `check`: unquoted `200` / `true` / `null` are number / bool / null; quote to force a string (`== "200"`). Write **all** operator expects **unquoted** — `!= null`, `>=# 24`, `=* …`, `=1d~ <<c:datetime>>`, etc. Do not hand-quote them (`'>=# 24'` is wrong); Multimeter handles YAML-unsafe ops.

Prefer **accurate** expects over bare `!= null`: live timestamps with `=Ns~ <<c:datetime>>` / `<<c:date>>` (not `c:time`), fixed windows with `=^` / exact `e:` dates, numeric ranges, string contains/prefix, length (`=#` / `>=#`), fuzzy text (`>N%`), or exact equality when the value is known. See [Operators — Prefer accurate expects](./operators.md#prefer-accurate-expects-not-only--null).

**Prefer `expect` / `require` over a separate `check` / `assert` whenever the comparison only uses that call’s outputs** (plus literals / `e:` env). Keep standalone [check](./steps/check.md) / [assert](./steps/assert.md) for cross-step or two-output comparisons. Set `report: all` on the call when you want every expect row shown in the Report list (default external reporting is often fails-only).

```yaml
# Multiple expects on the same field (not follow-up - check:)
- call: login
  expect:
    status_code:
      - == 200
      - != 500
  report: all

# Nested field access
- call: getUser
  expect:
    body.user.name: == John
    body.user.active: true
  report: all

# With title and report
- call: login
  title: Login validation
  expect:
    status_code: 200
    token: != null
  report: all
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
