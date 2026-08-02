# HTML reports

## HTML reports

HTML reports are self-contained pages with inline CSS, dark/light theme support, visual pass/fail indicators, and no external dependencies.

Functional HTML reports show overview cards and test sections. Suite-only rows use the same layers-style suite icon as the Multimeter suite UI and are not expandable.

Load HTML reports show overview cards, load metrics, SVG time-series charts, snapshots, thresholds, and errors when available.

**Default filename:** `test-results.html`

  rampup: 10s
latency:                 # milliseconds
  min: 12
  avg: 48.2
  med: 41
  max: 880
  p90: 92
  p95: 120
  p99: 310
`http:`
  status_codes:
    "200": 2995
    "500": 5
  failed_requests: 5
  connect_avg: 3.2
  send_avg: 1.1
  waiting_avg: 42.8
  receive_avg: 1.4
thresholds:
  - `name:` p95 latency
    expression: p95 < 200
    actual: 120
    result: passed
  - `name:` error rate
    expression: error_rate < 0.01
    actual: 0.005
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

Format mapping for implementation:

- MMT (`.mmt`): write the full schema above. Functional reports use top-level `checks`; load reports use top-level `snapshots`.
- HTML: show overview cards, suite/test rows, layers-style suite icons, and load charts when applicable.
- Markdown: functional reports use a compact `## Tests` section; load reports include four single-series Mermaid `xychart` visualizations and snapshots as a compact table with numeric `at` values.
- JUnit XML: preserve CI compatibility by keeping normal `<testsuites>`/`<testcase>` output; add load metrics as `<properties>` using names such as `load.threads`, `load.throughput`, `load.latency.p95`, `load.error_rate`, and `load.snapshots.0.at`.

## HTML reports

A self-contained HTML page with inline CSS, dark/light theme support, and visual pass/fail indicators. No external dependencies — the file can be emailed, attached to a ticket, or served from any static host.

Functional HTML reports show overview cards and test sections. Suite-only rows use the same layers-style suite icon as the Multimeter suite UI and are not expandable.

Load HTML reports show overview cards, load metrics, SVG time-series charts, snapshots, thresholds, and errors when available.

**Default filename:** `test-results.html`
