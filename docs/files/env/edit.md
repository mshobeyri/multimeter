# Edit Environment

Open an environment file (`type: env`) in VS Code and click {{btn:edit:Edit Environment}} in the panel top bar to switch to **edit mode**. Use the back control to return to the runner view.

On the runner view, {{btn:check:Apply}} merges this file’s variables into the workspace Environment panel (without wiping other keys). {{btn:clear-all:Clear}} removes only the keys defined in this file. See [Environment overview](./index.md).

For workspace runtime variables and presets in the Multimeter sidebar, see [Environment variables panel](./ui.md).

## Tabs

| Tab | What you edit |
|---|---|
| {{btn:note:Overview}} | Top-level `import` map (JSON/YAML/CSV data files) |
| {{btn:symbol-variable:Variables}} | Variable definitions — choice maps, allowed-value lists, or OS (`$VAR`) |
| {{btn:tasklist:Presets}} | Preset groups that bind variables to choices |
| {{btn:settings-gear:Settings}} | HTTP defaults (`setting.http.version`, `setting.http.timeout`, …) |
| {{btn:shield:Certificates}} | Client certificate configuration for mTLS |

### Variables

Each variable is one of:

- A **key-value map** (named choices) — each choice may be a scalar or a nested object/array; presets (or the panel dropdown) select a key. Nested values are edited as JSON in the value field (e.g. `{"latitude":52.52,"longitude":13.41}`). Choice values may be `$VAR` [OS refs](./os-variables.md) or `./….mmt` [live](./live-variables.md) paths.
- An **array list** (allowed values, scalars only) — presets or the runner pick from the list
- **OS** — a single process env name, stored as `$NAME` in YAML (see [OS variables](./os-variables.md))

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
