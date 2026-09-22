# Edit Suite

Open a suite file in VS Code and click {{btn:edit:Edit Suite}} in the suite panel top bar to switch from the **suite runner** to **edit mode**. Use the back control on the edit header to return to the runner.

The separate {{btn:type-hierarchy-sub:Flow chart}} control opens a read-only hierarchy view of suite items.

## Tabs

Edit mode shows a tab bar with six tabs:

| Tab | What you edit |
|---|---|
| {{btn:note:Overview}} | `title`, `description`, `tags`, and data `import` map |
| {{btn:beaker:Items}} | Suite item tree — add, reorder, and group entries; `then` separators create parallel stages |
| {{btn:filter:Filter}} | `filter.only` / `filter.skip` tags that decide which items run |
| {{btn:server-environment:Servers}} | Mock server files (`type: server`) started at the beginning of this suite |
| {{btn:symbol-namespace:Environment}} | Preset, env file, and inline variable overrides for the suite run |
| {{btn:export:Exports}} | Report export paths (HTML, JSON, Markdown, MMT, JUnit) |

### Overview

Edit `title`, `description`, `tags`, and top-level `import` entries (JSON/YAML/CSV data files referenced with `${alias.path}`). See [Data imports](../../features/data-imports.md).

### Items

The Items tab shows the suite as an editable tree:

- Add `.mmt`, `.http`, `.https`, or `.bru` file paths
- Drag to reorder within a group
- Insert **then** to start a new parallel stage (items before and after `then` run sequentially; items within a stage run in parallel)
- Missing files and circular references are flagged in the runner view

Paths can be relative to the suite file or use the `+/` project-root prefix. See [items](./items.md).

### Filter

Two tag inputs write `filter.only` and `filter.skip` on the suite file:

- **Only tags** — run just the tests and suites whose `tags:` include one of them. Empty runs everything.
- **Skip tags** — never run tests and suites carrying one of them. Skip wins over only.

Tags are matched against `tags:` on test and suite files, so a tagged suite selects its whole subtree. Filtered-out items appear with a skip icon in the runner. After a run, the suite panel shows the active filter **below Items** (with **Total: N skipped** when applicable). See [Tag filter](./execution.md#tag-filter) and the [suite tag filter example](../../../examples/intermediate/29_suite_tag_filter/README.md).

### Servers

List mock server files to start at the beginning of this suite, before items. See [Mock servers in suites](../server/in-suites.md). Listing the same server both here and under **Items** is an error: both paths are underlined in red. The same server in a nested suite is fine. Put a server in **Items** only when it should start in the middle of the suite (at that stage).

### Environment

Configure `environment.preset`, `environment.file`, and optional inline `environment.variables` for the suite run.

### Exports

Add output paths for generated reports after a suite run.

---

See also: [Suite overview](./index.md) · [items](./items.md) · [import](./import.md) · [Execution](./execution.md) · [Reference](./reference.md)
