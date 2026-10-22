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
  # Any c: token works in paths (git folder, date, commit, …)
  - +/reports/<<c:report_folder>>/results.html
  - +/reports/<<c:date>>/suite-<<c:commit_short>>.html
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

Any `c:` current token is expanded in export paths before write — clock/locale (`c:date`, `c:time`, `c:epoch`, …), git (`c:commit`, `c:branch`, …), and `c:report_folder`. Offsets work too (`<<c:date(+7d)>>`). Values are path-sanitized (e.g. `:` in times becomes `-`). Prefer `<<c:name>>` or a path segment `c:name`. See [Current tokens](../../features/dynamic-values/current.md).

CLI `--report-file` expands the same way:

```sh
npx testlight run suite.mmt --report html --report-file './reports/<<c:report_folder>>/out.html'
```

### Root-only fields

These fields only take effect when the suite is the **root entry point** (run directly). When Suite A imports Suite B, these fields in Suite B are ignored:

| Field | Behavior |
|-------|----------|
| `servers` | Starts mock servers before tests |
| `environment` | Configures environment variables |
| `export` | Generates reports after completion |

This design prevents conflicts when suites are composed hierarchically.

See also: [Report formats](../report/index.md) · [CLI & environment](./cli.md) · [Execution](./execution.md) · [Testlight](../../features/testlight/index.md)
