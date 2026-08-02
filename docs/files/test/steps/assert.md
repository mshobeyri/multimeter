# assert

Use `assert` when a failed comparison must **stop the test flow**. Syntax, operators, and report options are identical to [check](./check.md) — only the failure behavior differs.

| Step | On failure |
|------|------------|
| [check](./check.md) | Log and report; continue |
| **assert** | Log and report; **stop execution** |
| [expect on call/http](./call.md#expect) | Same as check (non-throwing) |

## Examples

```yaml
- assert: ${doLogin.status} == 200
- assert: ${profile.token} != omit
```

Object form (same fields as check):

```yaml
- assert:
    actual: ${doLogin.status}
    expected: 200
    operator: "=="
    title: Login status
```

Operators, `omit` handling, output paths, and `report` configuration: [check](./check.md).

---

See also: [check](./check.md) · [call](./call.md) · [run](./run.md)
