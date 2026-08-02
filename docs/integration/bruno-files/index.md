# Bruno Files

Multimeter can open Bruno `.bru` request files as runnable test flows. This is intended for teams migrating from Bruno or reusing existing Bruno requests while still running through Multimeter's normal test runner, reporting, environment handling, and suite execution.

Multimeter does not take ownership of `.bru` files by default. In VS Code, use **Open With...** and choose **Multimeter Bruno Test Editor** when you want to run a Bruno request with Multimeter.

You can also import `.bru` files from `type: test` `.mmt` files. Multimeter converts each Bruno request file to a test flow internally, so the alias can be used with a normal `call` step.

```yaml
type: test
title: Reuse Bruno request
import:
  profile: requests/get_profile.bru
steps:
  - call: profile
```

- [Supported Bruno Syntax](./supported-bruno-syntax.md)
- [Editing And Saving](./editing-and-saving.md)
- [Current Limitations](./current-limitations.md)

Example: [Import Bruno in test](../../../examples/intermediate/16_bruno_files/README.md)
