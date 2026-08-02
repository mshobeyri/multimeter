# Reports

After you run a load test, the **load test panel** shows live and final load metrics — requests, failures, success rate, throughput, and latency percentiles.

Load reports are compact and load-oriented. They do **not** keep every individual test iteration.

| Format | What you get |
|--------|--------------|
| MMT (`.mmt`) | `type: report`, `kind: load`, root-level load fields, and `snapshots` |
| HTML (`.html`) | Overview cards, load metrics, SVG time-series charts, snapshots, thresholds, and errors when available |
| Markdown (`.md`) | Overview, metric tables, Mermaid `xychart` blocks, and snapshot tables |
| JUnit XML (`.xml`) | Normal `<testsuites>` compatibility with load metrics as `<property>` values such as `load.threads`, `load.throughput`, and `load.snapshots.0.at` |

Use {{btn:export:Export}} on the run bar or the `export:` field to save reports. See [Exports](./exports.md).

See [Report — Load report schema](../report/reference.md#load-report-kind-load) for the generated report shape.

## Differences from suites

| Suite (`type: suite`) | Load Test (`type: loadtest`) |
|-----------------------|------------------------------|
| Uses `items` | Uses `test` |
| Runs multiple APIs/tests/suites | Runs one `type: test` scenario repeatedly |
| Supports staged execution with `then` | Supports concurrency, ramp-up, and repeat limits |
| Can start suite-level mock servers | Does not have suite-level `servers` |
| Functional reports include `checks` | Load reports use root metrics and `snapshots` |

Use a suite when you want to orchestrate many files. Use a load test when you want to measure one scenario under repeated or concurrent execution.

---

See also: [Load Test overview](./index.md) · [Report overview](../report/index.md) · [Exports](./exports.md) · [CLI](./cli.md)
