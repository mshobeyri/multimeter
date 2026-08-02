# Load test exports

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

| Extension | Format | Description |
|-----------|--------|-------------|
| `.mmt` | MMT | Structured load result data in YAML |
| `.html` | HTML | Human-readable report with load metrics, SVG charts, and snapshots |
| `.md` | Markdown | Plain text load summary with Mermaid charts and snapshot table |
| `.xml` | JUnit XML | CI-compatible XML with load metrics as properties |

Exports are generated after the load test finishes. Paths can be relative to the load test file or use `+/` for project root paths. Parent directories are created automatically if they don't exist.

You can also generate reports from the CLI with `--report` and `--report-file`. See [CLI](./cli.md) and [Report — CLI & auto-export](../report/cli.md).

See also: [Reports](./reports.md) · [Reference](./reference.md)
