# Environment and export

## `environment`
Use the `environment` field to configure environment variables for load test runs. It uses the same shape as suite environment configuration.

```yaml
type: loadtest
title: Load test with environment
environment:
  preset: staging
  file: ./envs/custom.mmt
  variables:
    API_URL: https://staging.example.com
threads: 20
repeat: 30s
test: ./tests/login.mmt
```

#### Fields

| Field | Type | Description |
|-------|------|-------------|
| `preset` | `string` | Preset name to select from `multimeter.mmt` (or from `file` if specified) |
| `file` | `string` | Path to an env file to load (relative to the loadtest file or `+/` for project root) |
| `variables` | `Record<string, any>` | Inline key-value environment variables |

#### Priority Order

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

## `export`
Use the `export` field to automatically generate reports after load test completion.

```yaml
type: loadtest
title: CI Load Test
threads: 50
repeat: 1m
rampup: 10s
export:
  - ./reports/load-results.mmt
  - ./reports/load-results.html
  - ./reports/load-results.md
  - ./reports/load-results.xml
test: ./tests/login.mmt
```

#### Supported Export Formats

| Extension | Format | Description |
|-----------|--------|-------------|
| `.mmt` | MMT | Structured load result data in YAML |
| `.html` | HTML | Human-readable report with load metrics, SVG charts, and snapshots |
| `.md` | Markdown | Plain text load summary with Mermaid charts and snapshot table |
| `.xml` | JUnit XML | CI-compatible XML with load metrics as properties |

Exports are generated after the load test finishes. Paths can be relative to the load test file or use `+/` for project root paths. Parent directories are created automatically if they don't exist.
