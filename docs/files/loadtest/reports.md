# Reports

## Reports

Load tests produce compact load-oriented reports. They do **not** keep every individual test iteration in the report.

- MMT (`.mmt`) reports use `type: report`, `kind: load`, root-level load fields, and `snapshots`.
- HTML reports include overview cards, load metrics, SVG time-series charts, snapshots, thresholds, and errors when available.
- Markdown reports include overview, metric tables, Mermaid `xychart` blocks, and snapshot tables.
- JUnit XML reports keep normal `<testsuites>` compatibility and write load metrics as `<property>` values such as `load.threads`, `load.throughput`, and `load.snapshots.0.at`.

See [Reports — Load Test Report Schema](./report.md#load-test-report-schema) for the generated report shape.

## Differences from suites

| Suite (`type: suite`) | Load Test (`type: loadtest`) |
|-----------------------|------------------------------|
| Uses `items` | Uses `test` |
| Runs multiple APIs/tests/suites | Runs one `type: test` scenario repeatedly |
| Supports staged execution with `then` | Supports concurrency, ramp-up, and repeat limits |
| Can start suite-level mock servers | Does not have suite-level `servers` |
| Functional reports include `checks` | Load reports use root metrics and `snapshots` |

Use a suite when you want to orchestrate many files. Use a load test when you want to measure one scenario under repeated or concurrent execution.
