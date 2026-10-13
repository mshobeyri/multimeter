# check

Use `check` to validate a value during a test run. A failed check is logged and reported, but **execution continues**. To stop the flow on failure, use [assert](./assert.md).

For AI / non-deterministic evaluation (semantic quality, rubrics), use [judge](./judge.md) with nested `expect` / `require` blocks instead of fuzzy operators alone.

Checks also power inline `expect` on [call](./call.md) and [http](./http.md) steps (non-throwing) and `condition` on [stages](../stages/stage-condition.md) and [if](./if.md) steps.

Comparison operators are documented in [Operators](../operators.md); missing values use [omit](../omit.md). Report levels (`all` / `fails` / `none`) are documented in [Reports — Report levels](../reports.md#report-levels-all-fails-none).

## Inline form

Write a single comparison string: `actual operator expected`. Combine clauses with `&&` and `||` (same precedence as `if` conditions).

```yaml
- check: ${doLogin.status} == 200
- check: ${profile.name} =* /John/i
- check: ${xml.active} =S true
- check: ${profile.name} >80% Jon
- check: ${profile.roles} =# 2
- check: ${createdAt} =5s~ ${updatedAt}
- check: ${a.status} == 200 && ${a.token} != omit
```

> **Important:** The inline form is the whole value of `check`. `title`, `details` and `report` are **not** sibling keys of `check:` — to use any of them, switch to the [object form](#object-form):
> ```yaml
> # Wrong: title next to an inline check
> - check: ${doLogin.status} == 200
>   title: Login status
>
> # Right: object form
> - check:
>     title: Login status
>     actual: ${doLogin.status}
>     operator: ==
>     expected: 200
> ```

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
| `operator` | no | Comparison operator (default `==`). See [Operators](../operators.md). |
| `title` | no | Label shown in reports instead of the raw comparison. |
| `details` | no | Extra context shown when the check fails. |
| `report` | no | When to emit this result: `all`, `fails`, `none`, or `{ internal, external }`. See [Reports — Report levels](../reports.md#report-levels-all-fails-none). |

## Operators

Full operator table and output-path rules: [Operators](../operators.md). Missing values: [omit](../omit.md).

## Report configuration

`report: all` | `fails` | `none` (or `{ internal, external }`) controls which results appear in the Report list. Default: `internal: all`, `external: fails`.

Full explanation and examples: [Reports — Report levels](../reports.md#report-levels-all-fails-none).

Checks and assertions appear in the Log panel while the flow runs. The report level also determines the [log level](../../../features/logging/test-logging.md#checks-and-asserts) for each result.

![Log panel](../../../screenshots/test_panel_log.png)

For run-summary cards and step reports, see [Reports](../reports.md).

---

See also: [Operators](../operators.md) · [omit](../omit.md) · [assert](./assert.md) · [call — expect](./call.md#expect) · [Inline expect](../inline-expect.md) · [Outputs](../../api/outputs.md) · [Logging (Output panel)](../../../features/logging.md)
