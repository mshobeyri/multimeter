# Environment variables panel

![Environment variables panel — presets and variables table](../../screenshots/environment-variables-panel.png)

Open the **Multimeter** bottom panel and choose **Environment Variables** ({{btn:server-environment:Environment Variables}}). This panel holds workspace runtime variables and presets used by API runs, tests, and suites.

Toolbar actions (top right of the view):

| Control | What it does |
|---|---|
| {{btn:refresh:Reload}} | Re-read workspace environment variables and presets from storage |
| {{btn:clear-all:Clear}} | Opens a menu: clear **file**, **manual**, or **runtime** variables, or **Clear all** (presets too). Each action asks for confirmation. |

## Presets

When an environment file defines preset groups, they appear under **Presets**. Each row is a group name (for example `runner`) with a dropdown to pick a named option (for example `dev` or `prod`). Changing a preset applies that group's variable bindings.

## Variables table

| Column | What it shows |
|---|---|
| **Name** | Variable name — referenced as `e:name` or `<<e:name>>` in tests and APIs |
| **Label** | Selected choice from the env file definition (dropdown when the variable has choices) |
| **Value** | Resolved runtime value — edit inline when the variable allows it. File-backed `./….mmt` values show a file icon and an open control inside the field |

Number, boolean, object, and list values keep their types in JSON requests and in this panel. Suite and API `setenv` writes appear here as runtime variables after a run.

Click {{btn:add}} next to **Environment Variables** to add a new row. Enter a name and value, then confirm with **Add** (or cancel). Manual rows are stored in workspace runtime only — they are not written to the `.mmt` file. Use {{btn:close}} on a row (inside the value field) to remove that variable from the workspace.

To change variable definitions, preset groups, HTTP settings, or certificates in the `.mmt` file, see [Edit Environment](./edit.md).

---

See also: [Environment overview](./index.md) · [CLI](./cli.md) · [Project root](./project-root.md) · [Reference](./reference.md) · [Panels](../../panels/index.md)
