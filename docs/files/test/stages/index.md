# Stages

Stages let you run groups of steps in parallel. All stages start concurrently; use `after` to control order. If you have a single linear flow, you can skip stages and place [steps](../steps/index.md) at the test root.

```yaml
stages:
  - id: login
    title: Login Stage
    steps:
      - call: login
        id: doLogin
  - id: profile
    after: login   # or
                          #   - login
                          #   - anotherStage
    steps:
      - call: getUser
        id: me
        inputs:
          token: ${doLogin.token}
```

| Topic | What it covers |
|---|---|
| [Stage condition](./stage-condition.md) | Skip a stage when a condition is false |

Step types (`call`, `http`, `assert`, …): [Steps overview](../steps/index.md).
