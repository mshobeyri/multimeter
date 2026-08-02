# Reference (types)

`type: report` files are generated output — not hand-authored. This page documents the MMT YAML schema written by `testlight` and the VS Code export.

## Common fields

- `type:` `report`
- `kind:` `functional` | `load`
- `name:` string — source file or run title
- `overview:` object — run summary (shape depends on `kind`)
- `cancelled:` boolean (optional) — set when the run was stopped early

## Functional report (`kind: functional`)

Used for test and suite runs. Top-level `checks` lists suite and test entries.

- `overview:`
  - `started_at:` ISO timestamp
  - `finished_at:` ISO timestamp (optional)
  - `duration:` string (e.g. `1.234s`)
  - `checks:` number — total check/assert steps
  - `passed:` number
  - `failed:` number
  - `errors:` number (always `0` in current output)
  - `skipped:` number (always `0` in current output)
- `checks:` array of check entries

### Check entry

Each item in `checks`:

- `name:` string
- `type:` `suite` | `test`
- `file:` string (optional) — source `.mmt` path
- `duration:` string (optional)
- `result:` `passed` | `failed`
- `checks:` array (optional) — nested step entries; omitted for `type: suite`

Suite entries are status-only rows and are not expandable in the report panel or exported HTML.

### Step entry (nested under a test)

- `name:` string — check or assert title
- `type:` `check`
- `step:` `assert` | `debug` (optional; omitted for `check` steps)
- `duration:` string (optional)
- `result:` `passed` | `failed`
- `expects:` array (optional) — per-comparison results
  - `comparison:` string
  - `result:` `passed` | `failed`
  - `actual:` any (on failure)
  - `expected:` any (on failure)
- `failure:` object (optional, on failed steps)
  - `message:` string
  - `actual:` string
  - `expected:` string
  - `operator:` string

```yaml
type: report
kind: functional
name: suite.mmt
overview:
  started_at: "2026-03-06T10:30:00.000Z"
  finished_at: "2026-03-06T10:30:01.234Z"
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
          message: "result.name ==: expected John got Jane"
          actual: Jane
          expected: John
          operator: "result.name =="
```

## Load report (`kind: load`)

Used for load test runs. Load metrics are stored at the report root — not under a nested `load` element — and load reports do not include per-iteration checks.

- `overview:` merges timing with load summary fields:
  - `started_at:` / `finished_at:` / `duration:` (same as functional)
  - `iterations:` number
  - `requests:` number
  - `successes:` / `failures:` number
  - `success_rate:` / `failed_rate:` / `error_rate:` number (0–1)
  - `throughput:` number (requests per second)
  - `data_received:` / `data_sent:` number (optional, bytes)
  - `errors:` / `skipped:` number (always `0` in current output)
- `test:` string — path to the underlying `type: test` file
- `config:` object
  - `threads:` number
  - `repeat:` string | number
  - `rampup:` string
- `latency:` object (milliseconds)
  - `min:` / `avg:` / `med:` / `max:` / `p90:` / `p95:` / `p99:` number
- `http:` object (optional)
  - `status_codes:` record&lt;string, number&gt;
  - `failed_requests:` number
  - `connect_avg:` / `send_avg:` / `waiting_avg:` / `receive_avg:` number (optional)
- `thresholds:` array (optional)
  - `name:` string
  - `expression:` string (optional)
  - `actual:` number (optional)
  - `result:` `passed` | `failed`
- `errors:` array (optional) — aggregated error messages
  - `message:` string
  - `count:` number
  - `rate:` number (optional)
- `snapshots:` array — per-second samples
  - `at:` number — elapsed seconds from run start, starting at `0`
  - `active_threads:` / `requests:` / `errors:` / `error_delta:` / `throughput:` / `response_time:` / `error_rate:` / `p95:` number (optional)

```yaml
type: report
kind: load
name: Login Load Test
overview:
  started_at: "2026-05-04T10:30:00.000Z"
  finished_at: "2026-05-04T10:31:00.000Z"
  duration: 1m
  iterations: 1000
  requests: 3000
  successes: 2995
  failures: 5
  success_rate: 0.998
  failed_rate: 0.002
  error_rate: 0.002
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
    throughput: 50
    response_time: 48.2
    p95: 110
```

## Exported formats

The MMT schema above is the canonical source. Other formats are projections:

| Format | Notes |
|--------|-------|
| [HTML](./html.md) | Self-contained page with overview cards, suite/test rows, load charts |
| [Markdown](./markdown.md) | Compact `## Tests` section; load reports add Mermaid charts and snapshot tables |
| [JUnit](./junit.md) | Standard `<testsuites>`/`<testcase>` output; load metrics as `<property>` values such as `load.threads`, `load.throughput`, `load.latency.p95`, `load.snapshots.0.at` |

See also: [Overview](./index.md) · [CLI](./cli.md) · [Suite exports](../suite/exports.md) · [Load test exports](../loadtest/exports.md)
