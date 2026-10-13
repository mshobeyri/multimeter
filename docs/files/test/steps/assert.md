# assert

Use `assert` when a failed comparison must **stop the test flow**. Syntax, [operators](../operators.md), and [report](../reports.md#report-levels-all-fails-none) options are identical to [check](./check.md) — only the failure behavior differs.

| Step | On failure |
|------|------------|
| [check](./check.md) | Log and report; continue |
| **assert** | Log and report; **stop execution** |
| [expect on call/http](./call.md#expect) | Soft (continue) |
| [require on call/http](./call.md#require) | Hard (stop) — same map as expect |

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
    report: fails
```

- Operators: [Operators](../operators.md) · [omit](../omit.md)
- Report levels (`all` / `fails` / `none`): [Reports — Report levels](../reports.md#report-levels-all-fails-none)
- Object fields and inline form: [check](./check.md)

---

See also: [check](./check.md) · [Operators](../operators.md) · [call](./call.md) · [run](./run.md)
