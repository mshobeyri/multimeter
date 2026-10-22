# assert

Use `assert` when a failed comparison must **stop the test flow**. Syntax, [operators](../operators.md), and [report](../reports.md#report-levels-all-fails-none) options are identical to [check](./check.md) — only the failure behavior differs.

Prefer call [`require`](./call.md#require) (or soft [`expect`](./call.md#expect)) when the comparison only uses **that call’s** outputs. Keep standalone `assert` / `check` for **two different** values. See [Prefer accurate expects](../operators.md#prefer-accurate-expects-not-only--null).

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
    operator: "=="
    expected: 200
    title: Login status
    report: fails
```

- Operators: [Operators](../operators.md) · [omit](../omit.md)
- Report levels (`all` / `fails` / `none`): [Reports — Report levels](../reports.md#report-levels-all-fails-none)
- Object fields and inline form: [check](./check.md)

---

See also: [check](./check.md) · [Operators](../operators.md) · [call](./call.md) · [run](./run.md)
