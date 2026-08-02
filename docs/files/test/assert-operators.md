# Assert operators

Operators used by `check`, `assert`, and call-level [`expect`](./run-expect.md):

- `<`, `>`, `<=`, `>=`, `==`, `!=`
- `=i` (equal, ignore case), `!i` (not equal, ignore case)
- `=X` (equal after trim), `!X` (not equal after trim)
- `=iX` (trim + ignore case), `!iX` (trim + ignore case, not equal)
- `=@` (left is in right — both sides coerced to string; objects/arrays via JSON)
- `!@` (left is not in right)
- `=C` (left contains right — both sides coerced to string; objects/arrays via JSON)
- `!C` (left does not contain right)
- `=^` (starts with), `!^` (not starts with)
- `=$` (ends with), `!$` (not ends with)
- `=*` (regex match), `!*` (not regex match)
- `=~` (equal, type-unsafe / as string), `!~` (not equal, type-unsafe) — use for XML/text outputs that are always strings vs YAML `true` / `42`
- `=#` (string/number/list/object length equals), `!#` (not equal)
- `<#`, `<=#`, `>#`, `>=#` (length/count comparisons)
- `>N%` (fuzzy match at least N% similar), `<N%` (fuzzy match less than N%). Any whole percent from 0 to 100, for example `>80%`. In the visual UI these appear as `>%` and `<%` with a separate percentage selector.

#### omit

Use unquoted `omit` with `==` / `!=` to assert that a value is missing, `null`, or the omit sentinel (for example after a missing output path):

```yaml
- check: ${result.missingField} == omit
- check: ${result.token} != omit
```

Object-form:

- Use unquoted `expected: omit` to assert that a value/path is missing.
- For `operator: ==`, a missing path (`undefined`) is treated as `omit` and passes.
- For `operator: !=`, the check passes only when the value is present and not omit/null.

```yaml
- call: xx
  id: xxx

- check:
    title: username exists
    actual: ${xxx.body.body.username}
    operator: !=
    expected: omit

- check:
    title: nickname missing
    actual: ${xxx.body.body.nickname}
    operator: ==
    expected: omit
```

#### Output-path behavior

Runtime references like `${stepId.body.body.username}` and `${stepId.status}` use the same output fallback behavior as `expect`. Checks/asserts can read default output roots (`body`, `status`, `headers`, `cookies`, `duration`, `details`) from call results consistently.

See also: [check / assert](./assert.md) · [Inline expect](./run-expect.md) · [Outputs](../api/outputs.md)
