# Settings

Certificates: see [Certificates](../../features/certificates/index.md).

## Settings

Project-level runner settings can be configured in the `setting` section of the env `file:`

```yaml
setting:
  http:
    version: "auto"
    timeout: 30000
```

- `setting.http.version` records the preferred HTTP version as a string (`"auto"`, `"1"`, `"1.1"`, or `"2"`).
- HTTP/2 uses a basic request-response transport when supported by the Node runtime.
- `setting.http.timeout` sets the default HTTP request timeout in milliseconds.
- Per-request `timeout` fields in API files and test HTTP steps still override this default.
- If no env file timeout is set, Multimeter uses the built-in default of `30000` milliseconds.

## Reference (types)
- `type:` `env`
- `variables:` record<string, object (key-value choices) | array (allowed values)>
- `presets:` record<string, record<string, record<string, string|number|boolean|null>>>
- `setting:` { http?: { version?: "auto"|"1"|"1.1"|"2", timeout?: number } }
- `certificates:` { server_ca?, clients? }


## VS Code Settings

Multimeter exposes the following VS Code settings (accessible via Settings or `settings.json`):

| Setting | Default | Description |
|---------|---------|-------------|
| `multimeter.body.auto.format` | `true` | Auto-format response bodies (JSON pretty-print) |
| `multimeter.editor.fontSize` | `14` | Font size for the YAML editor (range: 8-40) |
| `multimeter.editor.defaultPanel` | `yaml-ui` | Default panel when opening `.mmt` files: `yaml-ui`, `yaml`, or `ui` |
| `multimeter.editor.collapseDescription` | `false` | Auto-collapse multi-line description fields when opening files |
| `multimeter.workspaceEnvFile` | `multimeter.mmt` | Path to the workspace environment file loaded on project open |
