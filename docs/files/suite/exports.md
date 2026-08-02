# Suite exports

Use the `export` field to automatically generate reports after suite completion. This is a **root-only** field — it only takes effect when the suite is run directly.

```yaml
type: suite
title: CI Suite
export:
  - ./reports/results.xml     # JUnit XML
  - ./reports/results.html    # HTML report
  - ./reports/results.md      # Markdown report
  - +/reports/results.mmt     # MMT format (project root)
items:
  - tests/login.mmt
  - tests/profile.mmt
```

| Extension | Format | Description |
|-----------|--------|-------------|
| `.xml` | JUnit XML | Standard CI format (Jenkins, GitLab, etc.) |
| `.html` | HTML | Human-readable report with styling |
| `.md` | Markdown | Plain text report for docs/PRs |
| `.mmt` | MMT | Structured result data in YAML |

Exports are generated **after the entire suite finishes** (regardless of success or failure). Paths can be relative to the suite file or use `+/` for project root. Parent directories are created automatically if they don't exist.

### Root-only fields

These fields only take effect when the suite is the **root entry point** (run directly). When Suite A imports Suite B, these fields in Suite B are ignored:

| Field | Behavior |
|-------|----------|
| `servers` | Starts mock servers before tests |
| `environment` | Configures environment variables |
| `export` | Generates reports after completion |

This design prevents conflicts when suites are composed hierarchically.

See also: [Report formats](../report/index.md) · [CLI & environment](./cli.md) · [Execution](./execution.md) · [Testlight](../../features/testlight/index.md)
