# Stages and steps

## Stages
Stages let you run groups of steps in parallel. All stages start concurrently; use `after` to control order. If you have a single linear flow, you can skip stages and place steps at the test root.

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

## Steps
Steps are the building blocks of a test. When placed at the test root, they run sequentially. Inside stages, steps run within that stage; parallelism is controlled by the stages. Use `call` when the request or flow already lives in a reusable imported file, and use `http` when you want to send a one-off HTTP request directly from the test.
You can visualize and run the flow from the Flow panel; each step here corresponds to a UI block in that panel.

![Flow panel](../screenshots/test_panel_flow.png)
