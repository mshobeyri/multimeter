# check / assert

Use `check` to log a failure and continue; use `assert` to stop the flow on failure.

Supported operators (including fuzzy match and length checks) are listed in [Assert operators](./assert-operators.md).

You can write checks and asserts in a concise inline form or in a structured object form with explicit `actual`, `expected`, `operator`, and an optional `title` or `details`.

Inline examples:

```yaml
- assert: ${doLogin.status} == 200
- check: ${profile.name} =* /John/i
- check: ${xml.active} =~ true
- check: ${profile.name} >80% Jon
- check: ${profile.roles} =# 2
```

> **Note:** Values referencing step ids, loop variables, or JS-scoped variables must use `${...}` to resolve at runtime:
> ```yaml
> - call: myApi
>   inputs:
>     name: ${row.name}
>     token: ${doLogin.token}
>   check:
>     - ${result.name} == ${row.expected_name}
> ```
> Without `${...}`, the text is treated as a literal string (e.g. `name: row.name` sends the text "row.name").

Object-form examples:

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
```

Use unquoted `omit` with `==` / `!=` to assert that a value is missing, `null`, or the omit sentinel. See [Assert operators](./assert-operators.md) for object-form `omit` details.

#### Report configuration

The `report` field controls when check/assert results are emitted. Useful when tests are imported or added to suites.

Values:
- `all` — report both passes and failures
- `fails` — report only failures (default for external)
- `none` — silent, no reporting

```yaml
- check:
    actual: status
    expected: 200
    report: all

- check:
    actual: status
    expected: 200
    report:
      internal: all   # when running this test directly
      external: fails # when imported or added to a suite
```

Default if omitted: `internal: all`, `external: fails`.

Checks, assertions, prints, and errors appear in the Log panel while the flow runs. The report level also determines the [log level](../../running/logging/index.md#checks-and-asserts) for each result.

![Log panel](../../../screenshots/test_panel_log.png)

Next: [Assert operators](./assert-operators.md) · [call](./call.md) · [run](./run.md)
