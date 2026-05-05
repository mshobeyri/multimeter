# Load Test .mmt

type: loadtest runs one type: test file with load-oriented configuration.

## Shape

```yaml
type: loadtest
title: Login load test
description: Stress the login flow
tags:
  - load
  - auth
environment:
  preset: perf
threads: 100       # optional, default: 1
repeat: 1m         # required: duration or total iteration count
rampup: 10s        # optional, default: 0s
export:
  - ./reports/login-load.mmt
test: ./tests/login.mmt
```

## Fields

- test: required path to a single type: test file.
- repeat: required duration or total iteration limit, for example 1m, 10s, or 1000.
- threads: optional target concurrency. Defaults to 1.
- rampup: optional time to reach the target thread count. Defaults to 0s.
- environment: optional env overlay, same shape as suite environment.
- export: optional report export paths.

## Repeat semantics

`repeat` controls when the load test stops:

- Numeric value (`repeat: 1000`): run exactly 1000 total test iterations across all threads, then finish.
- Duration string (`repeat: 1m`, `repeat: 10s`): keep starting iterations until the duration expires.

If `threads` is greater than 1, numeric repeat is still a total count, not a per-thread count.

## Reports

Load tests produce load-oriented reports:

- MMT (`.mmt`) reports include `kind: load` and a top-level `load` section.
- HTML reports include load summary cards and SVG time-series charts.
- Markdown reports include load tables and Mermaid `xychart` blocks for the same chart data.
- JUnit XML reports include load metrics as `<property>` values for CI compatibility.

## Differences From suite

- Uses test, not tests.
- Does not support servers.
- Targets one test file instead of an execution graph.

## Notes

- The referenced file should remain type: test.
- Functional test reports and load test reports may diverge in payload shape even though both are exported as type: report files.
- Load test report exports should use `type: report` with `kind: load` and a top-level `load` section for throughput, failures, request counts, latency fields, thresholds, and time-series data. See [Reports](./reports.md#load-test-report-schema).
