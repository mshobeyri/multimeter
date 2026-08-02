# Test quick start

Minimal HTTP test against the public test `server:`

```yaml
type: test
title: Simple HTTP test
description: Calls an HTTP endpoint directly and checks the response
steps:
  - http: https://test.mmt.dev/echo
    title: Send an echo request
    method: post
    body:
      message: hello world
    expect:
      status: 200
      body.body.message: hello world
```

- `http` sends the request directly — see [http step](./steps/http.md)
- `expect` validates output inline on the same step — see [Inline expect](./steps/run-expect.md)
- Use `call` instead when reusing a `type: api` file — see [call step](./steps/call.md)

More: [Steps](./steps/index.md) · [Stages](./stages/index.md) · [import](./import.md) · [Complete example](./complete-example.md)
