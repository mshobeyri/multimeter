# if

Conditionally run nested steps based on an expression. The true branch is `steps:`; an optional `else:` runs when the condition is false. There is no `elseif` — nest another `if` inside `else` when you need more branches.

Combine two (or more) comparisons with `&&` (and) or `||` (or). `&&` binds tighter than `||`. Surround `&&` / `||` with spaces. Conditions use the same [operators](../operators.md) as [check](./check.md).

```yaml
- if: ${doLogin.status} == 200
  steps:
    - call: getUser
      id: me
  else:
    - print: "Login failed"
    - if: ${doLogin.status} == 401
      steps:
        - print: "Unauthorized"
      else:
        - print: "Other error"

# AND / OR
- if: ${doLogin.status} == 200 && ${doLogin.body.ok} == true
  steps:
    - print: "Login succeeded"
- if: ${doLogin.status} == 401 || ${doLogin.status} == 403
  steps:
    - print: "Not allowed"
```

---

See also: [for](./for.md) · [repeat](./repeat.md) · [Operators](../operators.md) · [check](./check.md) · [print](./print.md)
