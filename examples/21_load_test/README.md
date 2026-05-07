# Load Test Example

This example shows a beta `type: loadtest` file that runs one normal `type: test` scenario repeatedly with concurrency, ramp-up, and report exports.

## Files

| File | Purpose |
|------|---------|
| `echo_api.mmt` | API request sent to the public test server |
| `echo_test.mmt` | Functional scenario run by each load test iteration |
| `loadtest.mmt` | Load test wrapper with `threads`, `repeat`, `rampup`, and `export` |

## Run from VS Code

Open `loadtest.mmt` and use the Multimeter Run action. The panel shows live load metrics while the run is active.

## Run from CLI

```sh
npx testlight run examples/21_load_test/loadtest.mmt
```

The `export` field writes reports after the run:

- `reports/echo-load.mmt` — native structured load report
- `reports/echo-load.html` — visual load report with charts
- `reports/echo-load.md` — Markdown load report with Mermaid charts
- `reports/echo-load.xml` — CI-compatible JUnit XML properties

You can also generate a one-off report path:

```sh
npx testlight run examples/21_load_test/loadtest.mmt --report html --report-file reports/load.html
```

## Learn more

- [Load Test docs](../../docs/loadtest-mmt.md)
- [Reports docs](../../docs/reports.md#load-test-report-schema)
