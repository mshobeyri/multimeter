# Stage condition
Stages support a `condition` field that skips the stage if the condition evaluates to false. The condition uses the same syntax as `if` / [check](../steps/check.md) inline expressions (including `&&` and `||`).

```yaml
stages:
  - id: login
    steps:
      - call: login
        id: doLogin
  - id: profile
    condition: ${doLogin.status} == 200
    after: login
    steps:
      - call: getProfile
```

Each side of a comparison is treated like a **YAML value** (so `200` is a number, `hello` / `12s` are strings). Use `${stepId.field}` to refer to a previous call/http result. Dynamic tokens such as `e:HOST` / `o:token` still work and become `${…}` references.
