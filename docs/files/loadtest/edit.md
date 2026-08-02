# Edit Load Test

For `type: loadtest` files opened in VS Code, the right panel has three pages:

1. **Load test runner** — run the load test and inspect live metrics
2. **Edit Load Test** — structured editor for the YAML definition
3. **Flow chart** — read-only view of the underlying test hierarchy

Click {{btn:edit:Edit Load Test}} in the top bar to switch to edit mode. Use the back control to return to the runner.

## Tabs

| Tab | What you edit |
|---|---|
| {{btn:note:Overview}} | Title, description, and tags |
| {{btn:references:Imports}} | Top-level `import` map (data files) |
| {{btn:beaker:Test}} | Path to the `type: test` file to run under load |
| {{btn:dashboard:Load}} | `threads`, `repeat`, and `rampup` settings |
| {{btn:symbol-namespace:Environment}} | Preset, env file, and inline variable overrides |
| {{btn:export:Exports}} | Report output paths (`.html`, `.xml`, `.md`, `.mmt`) |

### Overview

Edit title, description, and tags for documentation and filtering.

### Test and Load

Pick the test file path and configure concurrency settings. See [Load config](./load-config.md).

### Environment

Set `environment.preset`, `environment.file`, and optional inline overrides. See [Environment](./environment.md).

### Exports

Add paths for generated load test reports. See [Exports](./exports.md).

---

See also: [Load Test overview](./index.md) · [Reports](./reports.md) · [Reference](./reference.md)
