# check

Use `check` to validate a value during a test run. A failed check is logged and reported, but **execution continues**. To stop the flow on failure, use [assert](./assert.md).

Checks also power inline `expect` on [call](./call.md) and [http](./http.md) steps (non-throwing) and `condition` on [stages](../stages/stage-condition.md) and [if](./control-flow.md) steps.

## Inline form

Write a single comparison string: `actual operator expected`. Combine clauses with `&&` and `||` (same precedence as `if` conditions).

```yaml
- check: ${doLogin.status} == 200
- check: ${profile.name} =* /John/i
- check: ${xml.active} =~ true
- check: ${profile.name} >80% Jon
- check: ${profile.roles} =# 2
- check: ${a.status} == 200 && ${a.token} != omit
```

> **Note:** Values referencing step ids, loop variables, or JS-scoped variables must use `${...}`:
> ```yaml
> - call: myApi
>   id: result
>   inputs:
>     name: ${row.name}
> - check: ${result.name} == ${row.expected_name}
> ```
> Without `${...}`, the text is treated as a literal string.

## Object form

Use an object when you need explicit fields, a custom title, details, or per-check report settings:

```yaml
- check:
    actual: ${profile.name}
    expected: "John"
    operator: "=="
    title: "Profile name check"
    details: "Profile name must be John"
    report: all
```

| Field | Required | Description |
|-------|----------|-------------|
| `actual` | yes | Left-hand value — usually a `${...}` reference or literal. |
| `expected` | yes | Right-hand value to compare against. |
| `operator` | no | Comparison operator (default `==`). See [Operators](#operators). |
| `title` | no | Label shown in reports instead of the raw comparison. |
| `details` | no | Extra context shown when the check fails. |
| `report` | no | When to emit this result. See [Report configuration](#report-configuration). |

## Operators

Operators used by `check`, [assert](./assert.md), and call-level [`expect`](./call.md#expect):

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
| `=~`, `!~` | Equal / not equal, type-unsafe (as string) — use for XML/text outputs vs YAML `true` / `42` |
| `=#`, `!#` | String/number/list/object length equals / not equals |
| `<#`, `<=#`, `>#`, `>=#` | Length/count comparisons |
| `>N%`, `<N%` | Fuzzy match at least / less than N% similar (0–100, e.g. `>80%`). In the visual UI these appear as `>%` and `<%` with a separate percentage selector. |

### `omit`

Use unquoted `omit` with `==` / `!=` to test that a value is missing, `null`, or the omit sentinel (for example after a missing output path):

```yaml
- check: ${result.missingField} == omit
- check: ${result.token} != omit
```

Object form:

- `expected: omit` (unquoted) — assert that the value/path is missing.
- For `operator: ==`, a missing path (`undefined`) is treated as `omit` and passes.
- For `operator: !=`, the check passes only when the value is present and not omit/null.

```yaml
- check:
    title: username exists
    actual: ${xxx.body.body.username}
    operator: "!="
    expected: omit

- check:
    title: nickname missing
    actual: ${xxx.body.body.nickname}
    operator: "=="
    expected: omit
```

### Output-path behavior

Runtime references like `${stepId.body.body.username}` and `${stepId.status}` use the same output fallback behavior as `expect`. Checks can read default output roots (`body`, `status`, `headers`, `cookies`, `duration`, `details`) from call results consistently. See [Outputs](../../api/outputs.md).

## Report configuration

The `report` field controls when check results are emitted. Useful when tests are imported or added to suites.

Values:

- `all` — report both passes and failures
- `fails` — report only failures (default for external)
- `none` — silent, no reporting

```yaml
- check:
    actual: ${doLogin.status}
    expected: 200
    report: all

- check:
    actual: ${doLogin.status}
    expected: 200
    report:
      internal: all    # when running this test directly
      external: fails  # when imported or added to a suite
```

Default if omitted: `internal: all`, `external: fails`.

Checks and assertions appear in the Log panel while the flow runs. The report level also determines the [log level](../../../running/logging/index.md#checks-and-asserts) for each result.

![Log panel](../../../screenshots/test_panel_log.png)

For run-summary cards and step reports, see [Reports](../reports.md).

---

See also: [assert](./assert.md) · [call — expect](./call.md#expect) · [Inline expect](./run-expect.md) · [Outputs](../../api/outputs.md)
