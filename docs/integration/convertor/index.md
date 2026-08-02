# Convertor

Turn external API definitions into MMT files you can edit, run, and test.

Use **Convert to MMT...** from the Explorer right-click menu to import an existing source file and generate `.mmt` files that work across the Multimeter UI, CLI, and tests.

## What you can use it for
- Bootstrap a project from an existing API spec
- Quickly try endpoints in the UI without hand-writing all fields
- Create a consistent, typed starting point for tests
- Keep a read-only snapshot of a spec and iterate in MMT locally

## Supported sources
- OpenAPI: 3.x (typical JSON/YAML specs)
- Postman: Collections (v2)
- WSDL: SOAP API definitions
- HTTP files: `.http`, `.https`, `.rest`
- Bruno: `.bru`, `.bruno`

The command parses the source file and creates one or more `.mmt` API, test, suite, or environment files you can run immediately.

## How it works (at a glance)
1) Right-click a supported source file
2) Choose **Convert to MMT...**
3) Select the generated files you want to save
4) Choose a destination folder
5) Pick a collision policy when files already exist: skip, overwrite, or rename

Next: [Generated output](./generated-output.md)
