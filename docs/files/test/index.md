# Test

Use `type: test` to define a test MMT file. You can build complex flows with the elements below. Under the hood, Multimeter compiles your MMT to JavaScript and runs it inside VS Code or in CI with `testlight`.

Multimeter can also run `.http`, `.https`, and `.bru` files as test flows through the optional VS Code **Open With...** editors. See [HTTP Files](../integration/http-files/index.md) and [Bruno Files](../integration/bruno-files/index.md) for the supported syntax and save behavior.

Example:

```yaml
type: test
title: Login and get user info
tags:
  - smoke
import:
  create_session: create_session.mmt
  get_user_info: get_user_info.mmt
inputs:
  login_username: milad@gmail.com
  user: hassan@gmail.com
outputs:
  name: mehrdad
  family: shobeyri
  age: 35
steps:
  - call: create_session
    id: login
    inputs:
      username: i:login_username
      password: 654321
  - call: get_user_info
    id: user_info
    inputs:
      username: mahmood@gmail.com
      password: 123456
      session: ${login.session}
      user: i:user
  - set:
      outputs.name: ${user_info.name}
      outputs.family: ${user_info.family}
```

For the provided MMT, the Test panel shows the generated JavaScript. Click Run to execute the test.
![Test panel](../screenshots/test_panel_test.png)


## Structure

- [import](./import.md) · [cache](./cache.md) · [cache examples](./cache-examples.md)
- [Stages & steps](./stages.md)
- Steps: [call](./call.md) · [http](./http.md) · [run](./run.md) · [expect](./run-expect.md) · [assert](./assert.md) · [operators](./assert-operators.md)
- [Control flow](./control-flow.md) · [js](./js.md) · [Variables](./variables.md)
- [Stage condition](./stage-condition.md) · [Complete example](./complete-example.md) · [Reference](./reference.md)
