# Operators

Comparison operators used by [check](./steps/check.md), [assert](./steps/assert.md), and call/http [`expect`](./steps/call.md#expect) / [`require`](./steps/call.md#require) (and [`debug`](./steps/call.md#debug)). The same set powers `if` conditions and stage `condition` expressions.

Write comparisons as `actual operator expected` (inline) or with an explicit `operator:` field (object form).

Missing values use unquoted [`omit`](./omit.md), not an operator symbol.

## Operator reference

| Operator | Meaning |
|----------|---------|
| `<`, `>`, `<=`, `>=`, `==`, `!=` | Numeric / equality comparisons |
| `=i`, `!i` | Equal / not equal, ignore case |
| `=X`, `!X` | Equal / not equal after trim |
| `=iX`, `!iX` | Trim + ignore case |
| `=@`, `!@` | Left is in / not in right (both sides coerced to string; objects/arrays via JSON) |
| `=C`, `!C` | Left contains / does not contain right |
| `=^`, `!^` | Starts with / does not start with |
| `=$`, `!$` | Ends with / does not end with |
| `=*`, `!*` | Regex match / does not match |
| `=S`, `!S` | Equal / not equal as string — use for XML/text outputs vs YAML `true` / `42` |
| `=#`, `!#` | String/number/list/object length equals / not equals |
| `<#`, `<=#`, `>#`, `>=#` | Length/count comparisons |
| `>N%`, `<N%` | Fuzzy match at least / less than N% similar (0–100, e.g. `>80%`). In the visual UI these appear as `>%` and `<%` with a separate percentage selector. |
| `=Ns~`, `!Ns~` | Times within / not within velocity (e.g. `=5s~`, `!1m~`). A duration is required — bare `=~` is not a time operator. Combined durations work (`=1m30s~`, `=100ms~`). Both sides parse as ISO datetime, epoch seconds/ms, or `HH:mm[:ss]`. Quote clock times (`"14:30:00"`) so YAML does not treat them as numbers. In the visual UI these appear as `=s~` / `!s~` with a velocity field. |

Legacy `=~` / `!~` still run as as-string compares (`=S` / `!S`) so old files keep working. The YAML editor strikes them through; click to replace with `=S` / `!S`.

## Examples

```yaml
- check: ${doLogin.status} == 200
- check: ${profile.name} =* /John/i
- check: ${xml.active} =S true
- check: ${profile.name} >80% Jon
- check: ${profile.roles} =# 2
- check: ${createdAt} =5s~ ${updatedAt}

- call: echo
  expect:
    status_code: == 200
    echoed_message: =C hello
```

Expected sides follow the same YAML typing as `if` / `check`: unquoted `200` / `true` / `null` are number / bool / null; quote to force a string (`== "200"`).

## Output-path behavior

Runtime references like `${stepId.body.body.username}` and `${stepId.status}` use the same output fallback behavior as `expect`. Checks can read default output roots (`body`, `status`, `headers`, `cookies`, `duration`, `details`) from call results consistently. See [Outputs](../api/outputs.md).

---

See also: [omit](./omit.md) · [check](./steps/check.md) · [assert](./steps/assert.md) · [call — expect](./steps/call.md#expect) · [Inline expect](./inline-expect.md) · [Reports — report levels](./reports.md#report-levels-all-fails-none)
