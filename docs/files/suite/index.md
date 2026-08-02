# Suite

Use `type: suite` to define a suite MMT file. A suite runs multiple items together — tests, APIs, HTTP/Bruno files, or other suites. Open a suite file in VS Code to get the **suite panel** on the right (YAML stays on the left).

![Suite panel — overview cards, exports, and tests](../../screenshots/suite-panel.png)

## Suite panel UI

### Top bar

| Control | What it does |
|---|---|
| `title` | Suite title from `title:` (shown with the layers icon) |
| {{btn:type-hierarchy-sub:Flow chart}} | Opens a read-only hierarchy view of suite items |
| {{btn:edit:Edit Suite}} | Switches to **edit mode** — see [Edit Suite](./edit.md) |

See also: [Flow chart](../../features/flow-chart.md)

### Run bar

| Control | What it does |
|---|---|
| {{btn:play:Run suite}} | Runs all suite items. While running, turns into **Stop suite** |
| Right-click Run suite | Context menu: **Run in Core** |
| {{btn:export:Export}} | Export the run report (HTML, MMT, Markdown, or JUnit XML). Disabled until a run completes |

### Before and after a run

| Section | What you see |
|---|---|
| `environment` | Preset, env file, and inline variables when `environment:` is configured |
| `servers` | Mock server files listed in `servers:` |
| **Exports** | Report export paths from `export:` |
| **Overview** | **PASSED**, **FAILED**, **TOTAL**, and **DURATION** summary cards (after a run) — see [Reports](./reports.md) |
| **Tests** | Item tree grouped by execution stage — expand a test to see step reports — see [Reports](./reports.md#tests-tree) |

### Item tree

Each item shows an icon for its `type:`

| Type | Icon meaning |
|---|---|
| **API** | HTTP or WebSocket API file |
| **Test** | Test file with steps/stages |
| **Suite** | Nested suite |
| **Server** | Mock server file — started before items in the same stage |
| **Missing** | Referenced file not found |
| **Cycle** | Circular reference detected (not executed) |

Each item and stage group has a **Run** button for partial runs (subtree execution). Right-click for **Run in Core**. See [Execution — partial runs](./execution.md#partial-runs).

## Supported

- [items](./items.md) — tests, APIs, HTTP/Bruno files, nested suites
- [import](./import.md) — data file imports
- [Execution](./execution.md) — parallel stages with `then`, mock servers
- [Exports](./exports.md) · [CLI](./cli.md)

Sample:

```yaml
type: suite
title: Smoke Tests
tags:
  - smoke
items:
  - test/login_and_get_user_info.mmt
  - test/create_session.mmt
  - test/get_user_info.mmt
```

## Suite elements

- [Quick start](./quick-start.md) · [Edit Suite](./edit.md) · [Reports](./reports.md) · [Report overview](../report/index.md) · [Run a suite](../../tasks/run-suite.md)
- [import](./import.md) · [items](./items.md) · [Execution](./execution.md) · [Exports](./exports.md) · [CLI](./cli.md) · [Reference](./reference.md)
