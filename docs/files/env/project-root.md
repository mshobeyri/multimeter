# Project Root Marker

A file named `multimeter.mmt` (with `type: env`) placed at the root of your project serves as the **project root marker**. Prefer this name over a plain `env.mmt` for real projects — it is both the default workspace env file and the anchor for `+/` imports.

It enables:

1. **Workspace environment loading**: When configured, VS Code will automatically load variables, presets, settings, and certificates from `multimeter.mmt` into workspace storage on project open. Configure the path using `multimeter.workspaceEnvFile` setting (default: `multimeter.mmt` at project root).

2. **Project root imports**: In test and API files, **prefer the `+/` prefix** to import files relative to the project root (where `multimeter.mmt` exists) instead of long `../../…` paths relative to the current file. Paths stay valid when you move tests between folders.

For local example folders or smaller projects, runners also look for the nearest `env.mmt` when no configured `multimeter.mmt` is found. This is useful for keeping example-specific variables and certificates beside the tests that use them — for standalone `{product}-mmt` repos, ship `multimeter.mmt` at the repo root.

Example project structure:
```
project/
├── multimeter.mmt          # Project root marker + env defaults
├── api/
│   ├── auth.mmt
│   └── users.mmt
└── test/
    └── auth/
        └── test_login.mmt  # import: api: +/api/auth.mmt
```

In `test/auth/test_login.mmt`:
```yaml
import:
  auth: +/api/auth.mmt     # Resolves to project/api/auth.mmt — prefer this over ../../api/auth.mmt
```

See [Test documentation](../test/import.md#import) for more details on import paths.

Environment files also support JSON/YAML/CSV data imports for defining variables and `presets:`

```yaml
type: env
import:
  shared: ./shared-env.json
variables:
  api_url: ${shared.api_url}
```

See [Data imports](../../features/data-imports.md).

---
