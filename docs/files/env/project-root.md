# Project Root Marker

A file named `multimeter.mmt` (with `type: env`) placed at the root of your project serves as the **project root marker**. This enables:

1. **Workspace environment loading**: When configured, VS Code will automatically load variables, presets, settings, and certificates from `multimeter.mmt` into workspace storage on project open. Configure the path using `multimeter.workspaceEnvFile` setting (default: `multimeter.mmt` at project root).

2. **Project root imports**: In test and API files, you can use `+/` prefix to import files relative to the project root (where `multimeter.mmt` exists) instead of relative to the current file.

For local example folders or smaller projects, runners also look for the nearest `env.mmt` when no configured `multimeter.mmt` is found. This is useful for keeping example-specific variables and certificates beside the tests that use them.

Example project structure:
```
project/
├── multimeter.mmt          # Project root marker
├── apis/
│   ├── auth.mmt
│   └── users.mmt
└── tests/
    └── auth/
        └── login_test.mmt  # Can use +/apis/auth.mmt
```

In `tests/auth/login_test.mmt`:
```yaml
import:
  auth: +/apis/auth.mmt     # Resolves to project/apis/auth.mmt
```

See [Test documentation](../test/import.md#import) for more details on import paths.

Environment files also support JSON/YAML/CSV data imports for defining variables and presets:

```yaml
type: env
import:
  shared: ./shared-env.json
variables:
  api_url: ${shared.api_url}
```

See [Data Imports](../../integration/data-imports.md).

---
