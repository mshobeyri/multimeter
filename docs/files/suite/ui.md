# UI and Execution

When you open a suite file, the Multimeter panel displays the items in the suite, grouped by execution stage. Each item is shown with its name and an icon that indicates its type.

- **API**: Represented by an icon indicating the protocol (e.g., HTTP, WebSocket).
- **Test**: Represented by a test icon.
- **Suite**: Represented by a suite icon, indicating a nested suite.

This visual representation helps you understand the structure of your suite at a glance. You can run the entire suite from this panel.

### Node types
Each item in the suite tree is shown with an icon indicating its type:
- **API**: HTTP or WebSocket API file
- **Test**: Test file with steps/stages
- **Suite**: A nested suite (suites can include other suites recursively)
- **Server**: Mock server file (`type: server`) — started before tests in the same stage
- **Missing**: The referenced file could not be found at the specified path
- **Cycle**: A circular reference was detected (Suite A includes Suite B which includes Suite A)

The system automatically detects and prevents circular references. If a cycle is found, the offending entry is shown as a `cycle` node and is not executed.

### Partial runs (Run on an item)
The Suite panel also supports running a single item (or a subtree) from within the suite tree.

- Suite runs are executed via a **suite bundle**.
- Each runnable node in the bundle has an `id`.
- Clicking **Run** on a node sends that node `id` as `target` to the extension host.
- Core executes the subtree rooted at `target` and emits reports tagged with the same `id` so the UI routes output to the correct item.

If you see output appear under the wrong item, it usually means report events are being routed without using `id` (or a per-run `runId`).

Here is a sample of the UI for running a suite:
![Suite panel](../screenshots/suite.png)
