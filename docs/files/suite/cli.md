# Running suites from the CLI

Use `testlight` to run a suite from the command line or CI:

```sh
testlight run path/to/suite.mmt --env-file env.mmt --preset dev
```

The suite runner executes stages sequentially. Within each stage (items between `then` separators), tests run in parallel. Results are reported per item.

---

### Environment configuration

Use the `environment` field to configure environment variables for suite runs. This is a **root-only** field — it only takes effect when the suite is run directly, not when imported by another suite.

```yaml
type: suite
title: Integration Tests
environment:
  preset: staging                       # preset from multimeter.mmt
  file: ./envs/custom.mmt               # optional: use another env file
  variables:                            # inline variables
    API_URL: http://localhost:8080
    TIMEOUT: 30000
items:
  - tests/login.mmt
  - tests/profile.mmt
```

| Field | Type | Description |
|-------|------|-------------|
| `preset` | `string` | Preset name from `multimeter.mmt` (or from `file`) |
| `file` | `string` | Path to an env file (relative or `+/` for project root) |
| `variables` | `Record<string, any>` | Inline key-value environment variables |

**CLI (testlight) priority:** CLI `-e` → suite `environment.variables` → suite `environment.preset` → CLI `--env-file`/`--preset` → project defaults.

**VS Code UI priority:** suite `environment.variables` → suite `environment.preset` → VS Code local storage → Environment panel → project defaults.

Report exports and other root-only fields: [Suite exports](./exports.md).

Next: [Exports](./exports.md) · [Execution](./execution.md) · [Suite panel UI](./index.md#suite-panel-ui)
