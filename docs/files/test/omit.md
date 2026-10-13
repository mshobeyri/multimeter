# omit

Unquoted `omit` means a value is missing (or should be removed), not the string `"omit"`. Use it in comparisons and when passing inputs that should drop a request field.

## In checks and expects

Use `omit` with `==` / `!=` to test that a value is missing, `null`, or the omit sentinel (for example after a missing output path):

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

On call/http `expect` / `require`:

- Unquoted `omit` — field/path is missing.
- `null` — field exists with a null value.
- `!= omit` — field is present.

```yaml
- call: getUser
  expect:
    body.user.middle_name: omit
    body.user.first_name: != omit
```

## In call inputs

Pass unquoted `omit` to drop a field from the request the called API builds — the field is removed instead of being sent with a value. Use `"omit"` (quoted) to send the literal string:

```yaml
- call: echo
  id: result
  inputs:
    message: omit
```

API files use the same keyword under declared `inputs:` and request fields — see [API → Inputs](../api/inputs.md).

---

See also: [Operators](./operators.md) · [Inline expect](./inline-expect.md) · [check](./steps/check.md) · [call](./steps/call.md)
