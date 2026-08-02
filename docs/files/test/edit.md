# Edit Test

Open a test file in VS Code and click {{btn:edit:Edit Test}} in the runner top bar to switch from the **test runner** to **edit mode**. Use the back control on the edit header to return to the runner.

The separate {{btn:type-hierarchy-sub:Flow chart}} control opens a read-only flowchart view — it is not part of edit mode.

## Tabs

| Tab | What you edit |
|---|---|
| {{btn:search:Overview}} | Title, description, tags, imports, inputs, outputs, cache |
| {{btn:list-tree:Flow}} | Visual step editor for `steps:` or `stages:` |
| {{btn:code:Code}} | JavaScript compiled from the YAML test — generated output, not the source file |

### Overview

| Field | Notes |
|---|---|
| **Title** | Maps to `title:` |
| **Tags** | Searchable tag chips; maps to `tags:` |
| **Description** | Markdown editor; maps to `description:` |
| **Import** | Alias → path pairs with file picker (`.mmt`, CSV/JSON/YAML data, JS helper modules). Missing paths are highlighted |
| **Inputs** | Default input values for `i:` tokens |
| **Outputs** | Output variable declarations |
| **Cache** | Optional cache duration (`5m`), epoch number, or date/time string — see [cache](./cache.md) |

### Flow

The Flow tab is a visual editor for test steps. Each step type appears as a block you can add, reorder, and configure inline. Stages (parallel groups separated by `then`) are supported when the test uses `stages:` instead of a flat `steps:` list.

Use **Add item** to insert new steps (call, http, assert, delay, control flow, and more). The Flow view corresponds directly to the step types documented under [Steps](./steps/index.md).

![Flow view — call, delay, and const step blocks](../../screenshots/test-steps-flow.png)

### Code

The Code tab shows the JavaScript Multimeter generates from your YAML. It is read-only — edit the YAML or use the Flow tab to change behavior.

---

See also: [Test overview](./index.md) · [Quick start](./quick-start.md) · [Steps](./steps/index.md) · [Reference](./reference.md)
