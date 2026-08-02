# Edit Suite

Open a suite file in VS Code and click {{btn:edit:Edit Suite}} in the suite panel top bar to switch from the **suite runner** to **edit mode**. Use the back control on the edit header to return to the runner.

The separate {{btn:type-hierarchy-sub:Flow chart}} control opens a read-only hierarchy view of suite items.

## Tabs

Edit mode shows a tab bar with five tabs:

| Tab | Icon | What you edit |
|---|---|---|
| **Overview** | {{btn:note}} | Title, description, tags, and data `import` map |
| **Items** | {{btn:beaker}} | Suite item tree — add, reorder, and group entries; `then` separators create parallel stages |
| **Servers** | {{btn:server-environment}} | Mock server files (`type: server`) started before items in the same stage |
| **Environment** | {{btn:symbol-namespace}} | Preset, env file, and inline variable overrides for the suite run |
| **Exports** | {{btn:export}} | Report export paths (HTML, JSON, Markdown, MMT, JUnit) |

### Overview

Edit title, description, tags, and top-level `import` entries (JSON/YAML/CSV data files referenced with `${alias.path}`). See [Data Imports](../../integration/data-imports.md).

### Items

The Items tab shows the suite as an editable tree:

- Add `.mmt`, `.http`, `.https`, or `.bru` file paths
- Drag to reorder within a group
- Insert **then** to start a new parallel stage (items before and after `then` run sequentially; items within a stage run in parallel)
- Missing files and circular references are flagged in the runner view

Paths can be relative to the suite file or use the `+/` project-root prefix. See [items](./items.md).

### Servers

List mock server files to start automatically when the suite reaches that stage. See [Mock servers in suites](../server/in-suites.md).

### Environment

Configure `environment.preset`, `environment.file`, and optional inline `environment.variables` for the suite run.

### Exports

Add output paths for generated reports after a suite run.

---

See also: [Suite overview](./index.md) · [items](./items.md) · [import](./import.md) · [Execution](./execution.md) · [Reference](./reference.md)
