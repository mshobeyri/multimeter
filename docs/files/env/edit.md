# Edit Environment

Open an environment file (`type: env`) in VS Code. The right panel has two pages:

1. **Environment panel** (default) — pick presets and runtime variable values
2. **Edit Environment** — structured editor for the YAML file

Click {{btn:edit:Edit Environment}} in the top bar to switch to edit mode. Use the back control to return to the environment panel.

![Environment panel](../screenshots/environment_panel.png)

## Environment panel (runner view)

Before editing the file structure, you often work in the runner view:

| Control | What it does |
|---|---|
| {{btn:refresh:Reload}} | Reload workspace environment variables from the file |
| {{btn:clear-all:Clear}} | Clear environment variables from the workspace |
| **Preset groups** | Pick named preset combinations (`runner.dev`, `runner.prod`, …) |
| **Variable rows** | Dropdowns for choice maps; inline edit for plain values |

Choices (like `api_url: local | staging | prod`) appear as dropdowns. Edits here affect the workspace runtime; use edit mode to change the underlying `.mmt` definitions.

![Environment variables UI](../screenshots/environment_variables_ui.png)

## Edit tabs

| Tab | Icon | What you edit |
|---|---|---|
| **Overview** | {{btn:note}} | Top-level `import` map (JSON/YAML/CSV data files) |
| **Variables** | {{btn:symbol-variable}} | Variable definitions — choice maps or allowed-value lists |
| **Presets** | {{btn:tasklist}} | Preset groups that bind variables to choices |
| **Settings** | {{btn:settings-gear}} | HTTP defaults (`setting.http.version`, `setting.http.timeout`, …) |
| **Certificates** | {{btn:shield}} | Client certificate configuration for mTLS |

### Variables

Each variable is either:

- A **key-value map** (named choices) — presets select a key
- An **array list** (allowed values) — presets or the runner pick from the list

### Presets

Build hierarchical preset groups. A common pattern is `runner.dev` and `runner.prod` under a `runner` group. See [Overview — Define an environment file](./index.md#define-an-environment-file).

### Settings

Configure default HTTP behavior applied when this environment is active. See [Settings](./settings.md).

### Certificates

Attach client certificates for mutual TLS. See [Certificates](../../features/certificates/index.md).

## Promote values during API runs

In API definitions, use `setenv` to capture response values for later steps:

```yaml
setenv:
  token: body[token]
```

Values use the same extraction expressions as `outputs`. See [setenv](../api/setenv.md).

---

See also: [Environment overview](./index.md) · [CLI](./cli.md) · [Project root](./project-root.md) · [Reference](./reference.md)
