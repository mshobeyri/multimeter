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

Independent stages run as concurrent `async` IIFEs on a **single JavaScript thread**, so writes to hoisted step variables do not tear. There is no parallel mutation of the same key unless two stages share a **duplicate step `id`** — keep ids unique (last write wins).

To **read** another stage’s step result, set `after` so that stage’s promise is awaited first. Reading `${doLogin}` from a sibling stage without `after` can see `undefined`.

| Topic | What it covers |
|---|---|
| [Stage condition](./stage-condition.md) | Skip a stage when a condition is false |

Step types (`call`, `http`, `assert`, …): [Steps overview](../steps/index.md).
