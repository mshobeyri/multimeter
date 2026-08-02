# HTTP Files

Multimeter can open `.http` and `.https` files as test flows. This is intended for compatibility with common HTTP-client files while still running through Multimeter's normal test runner, reporting, environment handling, and suite execution.

Multimeter does not take ownership of `.http` files by default. In VS Code, use **Open With...** and choose **Multimeter HTTP Test Editor** when you want to run a `.http` file with Multimeter.

You can also import `.http` and `.https` files from `type: test` `.mmt` files. Multimeter converts the HTTP file to a test flow internally, so the alias can be used with a normal `call` step.

- [Supported Syntax](./supported-syntax.md)
- [Mapping to Test Flow](./mapping-to-test-flow.md)
- [Saving](./saving.md)
- [Current Limitations](./current-limitations.md)
