# Edit Environment

Open an environment file (`type: env`) in VS Code and click {{btn:edit:Edit Environment}} in the panel top bar to switch to **edit mode**. Use the back control to return to the runner view.

For workspace runtime variables and presets in the Multimeter bottom panel, see [Environment variables panel](./ui.md).

## Tabs

| Tab | What you edit |
|---|---|
| {{btn:note:Overview}} | Top-level `import` map (JSON/YAML/CSV data files) |
| {{btn:symbol-variable:Variables}} | Variable definitions — choice maps or allowed-value lists |
| {{btn:tasklist:Presets}} | Preset groups that bind variables to choices |
| {{btn:settings-gear:Settings}} | HTTP defaults (`setting.http.version`, `setting.http.timeout`, …) |
| {{btn:shield:Certificates}} | Client certificate configuration for mTLS |

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

In API definitions, use `setenv` to capture response values for later `steps:`

```yaml
setenv:
  token: body[token]
```

Values use the same extraction expressions as `outputs`. See [setenv](../api/setenv.md).

---

See also: [Environment overview](./index.md) · [Environment variables panel](./ui.md) · [CLI](./cli.md) · [Project root](./project-root.md) · [Reference](./reference.md)
