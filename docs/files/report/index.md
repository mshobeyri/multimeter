# Report

Multimeter generates structured reports after running tests, suites, or load tests. Reports are output artifacts — not authored directly — and are available from the CLI (`testlight`), suite/load-test `export:` fields, and the VS Code extension.

Open a generated `.mmt` file with `type: report` in VS Code to view the **report panel** (YAML stays on the left).

![Report panel — overview cards, test rows, and export](../../screenshots/test-reports.png)

## Report panel UI

### Top bar

| Control | What it does |
|---|---|
| `name` | Report title from the source run |
| {{btn:export:Export}} | Re-export to JUnit XML, MMT, HTML, or Markdown |

### Functional reports (`kind: functional`)

| Section | What you see |
|---|---|
| **Overview** | Pass/fail counts and duration — same card layout as [test](../test/reports.md#summary-cards) and [suite](../suite/reports.md) panels |
| **Checks** | Suite rows (layers icon, not expandable), test rows with collapsible check steps, failure details (expected, actual, operator) |

### Load reports (`kind: load`)

| Section | What you see |
|---|---|
| **Overview** | Iterations, requests, success rate, throughput, latency — same metrics as the [load test panel](../loadtest/reports.md) |
| **Charts** | SVG time-series for throughput, response time, and error rate |
| **Snapshots** | Per-second samples with numeric `at` values starting at `0` |

After any test, suite, or load test run in VS Code, use {{btn:export:Export}} on the run bar to save a report without re-running.

## Formats

| Extension | Format | Best for |
|-----------|--------|----------|
| `.mmt` | MMT Report YAML | Native review, diffing, and re-export — see [Reference](./reference.md) |
| `.html` | HTML | Sharing visual reports — see [HTML](./html.md) |
| `.md` | Markdown | PRs, issues, wikis — see [Markdown](./markdown.md) |
| `.md` (detailed) | Markdown detailed | Markdown plus request/response IO per step |
| `.xml` | JUnit XML | CI/CD test result publishing — see [JUnit](./junit.md) |

## How reports are generated

| Method | When to use |
|--------|-------------|
| `testlight run --report <format>` | CLI runs — see [CLI](./cli.md) |
| `export:` on suite or load test files | Auto-export after completion — see [Suite exports](../suite/exports.md) · [Load test exports](../loadtest/exports.md) |
| {{btn:export:Export}} in VS Code | Export after a panel run completes |

## Report elements

- [Quick start](./quick-start.md) · [JUnit](./junit.md) · [HTML](./html.md) · [Markdown](./markdown.md)
- [CI/CD](./ci.md) · [CLI](./cli.md) · [Reference](./reference.md)
