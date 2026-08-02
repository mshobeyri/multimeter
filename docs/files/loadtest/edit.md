# Edit Load Test

Open a `type: loadtest` file in VS Code and click {{btn:edit:Edit Load Test}} in the panel top bar to switch from the **load test runner** to **edit mode**. Use the back control to return to the runner.

The separate {{btn:type-hierarchy-sub:Flow chart}} control opens a read-only view of the underlying test hierarchy.

## Tabs

Edit mode shows six tabs:

| Tab | Icon | What you edit |
|---|---|---|
| **Overview** | {{btn:note}} | Title, description, and tags |
| **Imports** | {{btn:references}} | Top-level `import` map (data files) |
| **Test** | {{btn:beaker}} | Path to the `type: test` file to run under load |
| **Load** | {{btn:dashboard}} | `threads`, `repeat`, and `rampup` settings |
| **Environment** | {{btn:symbol-namespace}} | Preset, env file, and inline variable overrides |
| **Exports** | {{btn:export}} | Report output paths (`.html`, `.xml`, `.md`, `.mmt`) |

### Overview

Edit title, description, and tags for documentation and filtering.

### Test

Pick the test file path (relative to the load test file, or `+/` for project root). This is the flow that runs repeatedly under load. See [Elements — test](./elements.md).

### Load

Configure concurrency and `duration:`

- **Threads** — number of virtual users
- **Repeat** — iteration count or duration (e.g. `1m`, `100`)
- **Rampup** — time to reach full thread count (e.g. `10s`)

See [Elements](./elements.md) and [Running](./running.md).

### Environment

Set `environment.preset`, `environment.file`, and optional inline overrides for the load run. See [Environment & export](./environment.md).

### Exports

Add paths for generated load test reports. Supported formats: `.html`, `.xml` (JUnit), `.md`, `.mmt`.

---

See also: [Load Test overview](./index.md) · [Elements](./elements.md) · [Reports](./reports.md) · [Reference](./reference.md)
