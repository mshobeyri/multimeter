# Test Reports

Multimeter can generate structured reports after running `.mmt` test, suite, and load test files. Reports are available from both the CLI (`testlight`) and the VS Code extension.

## Formats

| Extension | Format | Best for |
|-----------|--------|----------|
| `.xml` | JUnit XML | CI/CD test result publishing |
| `.mmt` | MMT Report YAML | Native Multimeter review and re-export |
| `.html` | HTML | Sharing visual reports with stakeholders |
| `.md` | Markdown | PRs, issues, wikis, and docs |

## JUnit XML

JUnit XML is the universal CI/CD format. Azure Pipelines, GitHub Actions, GitLab CI, Jenkins, and many other systems can publish it directly.

**Default filename:** `test-results.xml`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="suite.mmt" tests="4" failures="1" errors="0" skipped="0" time="1.234">
  <testsuite name="test-file.mmt" tests="2" failures="1" errors="0" skipped="0" time="0.500" file="test-file.mmt">
    <testcase name="status == 200" classname="test-file.mmt" time="0.100"/>
    <testcase name="result.name == John" classname="test-file.mmt" time="0.050">
      <failure message="expected: John, actual: Jane, operator: ==" type="check">expected: John
actual: Jane
operator: ==</failure>
    </testcase>
  </testsuite>
</testsuites>
```

For load tests, JUnit XML keeps normal `<testsuites>` compatibility and adds load metrics as `<property>` values, for example `load.threads`, `load.throughput`, `load.latency.p95`, `load.error_rate`, and `load.snapshots.0.at`.

## MMT Report YAML

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
http:
  status_codes:
    "200": 2995
    "500": 5
  failed_requests: 5
  connect_avg: 3.2
  send_avg: 1.1
  waiting_avg: 42.8
  receive_avg: 1.4
thresholds:
  - name: p95 latency
    expression: p95 < 200
    actual: 120
    result: passed
  - name: error rate
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

## Markdown reports

A lightweight GitHub-flavored Markdown report for PRs, issues, wikis, or README files.

**Default filename:** `test-results.md`

Functional Markdown reports use a compact `## Tests` section:

```md
# Test Report: Mock Server Tests

## Overview

**Timestamp:** 2026-05-05T21:47:43.292Z  
**Duration:** 20ms  
**Result:** 1 passed, 0 failed, 1 total checks

## Tests
**✓ Mock Server Suite** passed

**✓ Health Check Test** passed

| # | Check | Result|
|---|------|--------|
| 1 | Health Check | ✓ passed |

---
*Generated by **Multimeter***
```

Load Markdown reports include overview, load metric tables, four single-series Mermaid `xychart` blocks, and a snapshots table with numeric `at` values.

## CLI usage

Use the `--report` flag with `testlight run`:

```bash
# Generate JUnit XML report
npx testlight run test.mmt --report junit

# Generate MMT YAML report
npx testlight run suite.mmt --report mmt

# Generate HTML report
npx testlight run loadtest.mmt --report html

# Generate Markdown report
npx testlight run test.mmt --report md
```

### Custom output path

Use `--report-file` to specify a custom output path:

```bash
npx testlight run suite.mmt --report junit --report-file results/output.xml
npx testlight run loadtest.mmt --report html --report-file reports/load.html
```

### Default output paths

| Format | Default filename |
|--------|-----------------|
| `junit` | `test-results.xml` |
| `mmt` | `test-results.mmt` |
| `html` | `test-results.html` |
| `md` | `test-results.md` |

## Auto-export from `.mmt` files

Suites can automatically generate reports after completion using the `export` field:

```yaml
type: suite
title: CI Suite
export:
  - ./reports/results.xml
  - ./reports/results.html
tests:
  - tests/login.mmt
  - tests/profile.mmt
```

Load tests can also automatically generate reports after completion:

```yaml
type: loadtest
title: Login Load Test
threads: 100
repeat: 1m
rampup: 10s
export:
  - ./reports/load-results.mmt
  - ./reports/load-results.html
  - ./reports/load-results.md
  - ./reports/load-results.xml
test: ./tests/login.mmt
```

See [Suite — Exports](./suite-mmt.md#exports) and [Load Test — Exports](./loadtest-mmt.md#export) for details.

## VS Code extension

### Export Report button

After running a test, suite, or load test in the VS Code extension, an **Export** button appears when a run result is available. Click it to choose a format:

- **JUnit XML** — for CI/CD integration
- **MMT Report** — for the `.mmt` ecosystem
- **HTML** — for sharing with stakeholders
- **Markdown** — for PRs and documentation

### Report viewer

Opening an `.mmt` file with `type: report` in VS Code renders a read-only visual panel showing:

- Overview header with pass/fail counts and duration
- Functional report rows for tests and suites
- Suite rows with the same layers icon used by suite files
- Collapsible test sections with individual check results
- Failure details (expected, actual, operator)
- Load report metrics and charts

The viewer includes an Export button to re-export the report to any format.

## CI/CD Integration

### Azure Pipelines

```yaml
steps:
  - script: npx testlight run suite.mmt --report junit
    displayName: Run Multimeter Tests

  - task: PublishTestResults@2
    inputs:
      testResultsFormat: JUnit
      testResultsFiles: test-results.xml
    condition: always()
```

### GitHub Actions

```yaml
steps:
  - name: Run tests
    run: npx testlight run suite.mmt --report junit

  - name: Publish test results
    uses: dorny/test-reporter@v1
    if: always()
    with:
      name: Multimeter Tests
      path: test-results.xml
      reporter: java-junit
```

### GitLab CI

```yaml
test:
  script:
    - npx testlight run suite.mmt --report junit --report-file report.xml
  artifacts:
    reports:
      junit: report.xml
```

### Jenkins

```groovy
pipeline {
    stages {
        stage('Test') {
            steps {
                sh 'npx testlight run suite.mmt --report junit'
            }
            post {
                always {
                    junit 'test-results.xml'
                }
            }
        }
    }
}
```

---

## See also
- [Testlight CLI](./testlight.md) — `--report` and `--report-file` flags
- [Test](./test-mmt.md) — test files that produce reports
- [Suite](./suite-mmt.md) — suite files that produce reports
- [Load Test](./loadtest-mmt.md) — beta load tests and load-oriented reports
- [Logging](./logging.md) — log levels during test runs
- [Sample Project](./sample-project.md) — full walkthrough with CI examples
