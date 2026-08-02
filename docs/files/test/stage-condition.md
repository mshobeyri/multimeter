# Stage condition
Stages support a `condition` field that skips the stage if the condition evaluates to false. The condition uses the same syntax as `if` / `assert` / `check` inline expressions (including `&&` and `||`).

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
