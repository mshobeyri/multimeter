# Environment

Use the `environment` field to configure environment variables for load test runs. It uses the same shape as [suite environment](../suite/reference.md).

```yaml
type: loadtest
title: Load test with environment
environment:
  preset: staging
  file: ./envs/custom.mmt
  variables:
    api_url: https://staging.example.com
threads: 20
repeat: 30s
test: ./tests/login.mmt
```

| Field | Type | Description |
|-------|------|-------------|
| `preset` | `string` | Preset name to select from `multimeter.mmt` (or from `file` if specified) |
| `file` | `string` | Path to an env file to load (relative to the load test file or `+/` for project root) |
| `variables` | `Record<string, any>` | Inline key-value environment variables |

### Priority order

Environment variables are resolved with different priority depending on the entry point:

**CLI (`testlight`):**
1. CLI `-e` flags (highest)
2. Load test `environment.variables`
3. Load test `environment.preset`
4. CLI `--env-file` + `--preset`
5. Project defaults (lowest)

**VS Code UI:**
1. Load test `environment.variables` (highest)
2. Load test `environment.preset`
3. VS Code local storage variables
4. Environment panel settings
5. Project defaults (lowest)

See also: [Environment CLI](../env/cli.md) · [CLI](./cli.md) · [Reference](./reference.md)
