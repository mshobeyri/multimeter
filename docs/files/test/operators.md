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

Write **all** operator expects **unquoted** in authored `.mmt` files — `!= null`, `>= 0`, `>=# 24`, `=# 1`, `=* …`, `=1d~ <<c:datetime>>`, `>60% …`, and the rest. Never write `'>=# 24'` or `"!= null"`. Multimeter quotes YAML-unsafe operators for the parser automatically. Quote only the **plain expected value** when you must force a string (e.g. `== "200"`, or a clock that would otherwise parse oddly):

```yaml
expect:
  token: != null
  hourly_count: >=# 24
  created_at: =* ^[0-9]{4}-[0-9]{2}-[0-9]{2}T
  observed_at: =1d~ <<c:datetime>>
  clock: "=14:30:00"   # quoted value only — not the operator
```

### Prefer accurate expects (not only `!= null`)

`!= null` only proves a field exists. When you know what “good” looks like, assert that instead — shape, range, prefix, closeness, or exact value. Put **all** validations that depend on a **single** call output on that call’s `expect` / `require` (use list form for several ops on one field). Do **not** follow up with `- check:` / `- assert:` for the same output — those steps are for comparing **two different** values (e.g. one output vs another step’s output). Use `report: all` on the call so every expect row stays visible in the Report list.

| Kind of output | Prefer | Examples |
|----------------|--------|----------|
| Exact known value | `==` / bare value | `status_code: 200`, `country: Germany` |
| Live / near-now timestamps | `=Ns~` + `<<c:datetime>>` / `<<c:date>>` | `observed_at: =1d~ <<c:datetime>>`, `daily_time_0: =2d~ <<c:date>>` — prefer this over a datetime regex. Do **not** use `c:time` (clock-only `HH:MM:SS`) against ISO datetimes. |
| Fixed past/future windows | `==` / `=^` vs `e:` dates | `daily_time_0: e:archive_start`, `hourly_time_0: =^ e:history_start` |
| String shape / format | `=*`, `=^`, `=$`, `=C` | id `=^ usr_`, email `=* @` (use `=Ns~` for datetimes when near now) |
| Numbers in a band | `>=` / `<=` / `<` / `>` (list form) | temperature `>= -80` and `<= 60`, `aqi: >= 0`, `score: >= 0.8` |
| Fuzzy text | `>N%` | `message: >80% Hello world` |
| Length / count | `=#`, `>=#`, … | `items: >=# 1`, `hourly.time: =# 24` |
| Presence only (last resort) | `!= null` | Unknown opaque tokens, optional upstream fields |

```yaml
- call: forecast
  id: weather
  expect:
    # near now — better than a datetime regex
    observed_at: =1d~ <<c:datetime>>
    weather_code:
      - >= 0
      - <= 99
    wind_speed: >= 0
    temperature:
      - >= -80
      - <= 60
  report: all
# check/assert only when comparing two different outputs:
- check: ${weather.daily_max} >= ${weather.daily_min}
```

Pick the tightest expect that stays stable for the API (fixed env dates, public fair-use ranges, documented enums). Loosen only where the upstream value is legitimately free to move.

## Output-path behavior

Runtime references like `${stepId.body.body.username}` and `${stepId.status}` use the same output fallback behavior as `expect`. Checks can read default output roots (`body`, `status`, `headers`, `cookies`, `duration`, `details`) from call results consistently. See [Outputs](../api/outputs.md).

---

See also: [omit](./omit.md) · [check](./steps/check.md) · [assert](./steps/assert.md) · [call — expect](./steps/call.md#expect) · [Inline expect](./inline-expect.md) · [Reports — report levels](./reports.md#report-levels-all-fails-none)
