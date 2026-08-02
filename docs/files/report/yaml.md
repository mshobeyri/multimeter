# MMT Report YAML

MMT reports are native YAML files with `type: report`. They are human-readable, easy to diff in pull requests, and can be opened in Multimeter for visual review and re-export.

**Default filename:** `test-results.mmt`

### Functional report schema

Functional reports use `kind: functional`, an `overview`, and top-level `checks`. Checks can represent suites, tests, or individual check steps.

```yaml
type: report
kind: functional
name: suite.mmt
overview:
  timestamp: "2026-03-06T10:30:00.000Z"
  duration: 1.234s
  checks: 4
  passed: 3
  failed: 1
  errors: 0
  skipped: 0
checks:
  - name: nested-suite.mmt
    type: suite
    result: passed
  - name: test-file.mmt
    type: test
    file: test-file.mmt
    duration: 0.500s
    result: failed
    checks:
      - name: status == 200
        type: check
        result: passed
        duration: 0.100s
      - name: result.name == John
        type: check
        result: failed
        duration: 0.050s
        failure:
          message: expected John got Jane
          actual: Jane
          expected: John
          operator: "=="
```

Suite entries are status-only rows. They are not expandable in the report viewer or exported HTML.

### Load test report schema

Load test reports use `kind: load`. Load metrics are stored at the report root, not under a nested `load` element, and load reports do not include per-iteration checks. This keeps reports compact even for large runs.

```yaml
type: report
kind: load
name: Login Load Test
overview:
  timestamp: "2026-05-04T10:30:00.000Z"
  duration: 1m
  iterations: 1000
  requests: 3000
  successes: 2995
  failures: 5
  success_rate: 0.9983
  failed_rate: 0.0017
  error_rate: 0.0017
  throughput: 50.0
  errors: 0
  skipped: 0
test: ./tests/login.mmt
config:
  threads: 100
  repeat: 1m
  rampup: 10s
latency:
  min: 12
  avg: 48.2
  med: 41
  max: 880
  p90: 92
  p95: 120
  p99: 310
http:
  status_codes:
    "200": 2995
    "500": 5
  failed_requests: 5
thresholds:
  - name: p95 latency
    expression: p95 < 200
    actual: 120
    result: passed
errors:
  - message: HTTP 500
    count: 5
    rate: 0.005
snapshots:
  - at: 0
    active_threads: 20
    requests: 500
    errors: 0
    error_delta: 0
    throughput: 50
    response_time: 48.2
    error_rate: 0
    p95: 110
```

Snapshots use numeric `at` values, starting at `0`, instead of timestamps per sample.
