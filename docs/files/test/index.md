# Test

Use `type: test` to define a test MMT file. You can build complex flows with the elements below. Under the hood, Multimeter compiles your MMT to JavaScript and runs it inside VS Code or in CI with `testlight`.

Multimeter can also run `.http`, `.https`, and `.bru` files as test flows through the optional VS Code **Open With...** editors. See [HTTP Files](../integration/http-files/index.md) and [Bruno Files](../integration/bruno-files/index.md) for the supported syntax and save behavior.

Example:

```yaml
type: test
title: Echo POST
steps:
  - http:
      url: https://test.mmt.dev/post
      method: post
      format: json
      body:
        hello: world
  - expect:
      status: 200
      body.json.hello: world
```

Click {{btn:play:Run}} to execute the test.


## Structure

- [import](./import.md) · [cache](./cache.md) · [cache examples](./cache-examples.md)
- [Stages & steps](./stages.md)
- Steps: [call](./call.md) · [http](./http.md) · [run](./run.md) · [expect](./run-expect.md) · [assert](./assert.md) · [operators](./assert-operators.md)
- [Control flow](./control-flow.md) · [js](./js.md) · [Variables](./variables.md)
- [Stage condition](./stage-condition.md) · [Complete example](./complete-example.md) · [Reference](./reference.md)
