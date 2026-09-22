# Reports

After you run a suite, the **suite panel** shows the same **Overview** summary cards as the [test runner](../test/reports.md#summary-cards). They aggregate check/assert results across every suite item that ran.

![Suite panel overview cards](../../screenshots/suite-panel.png)

## Summary cards

The four cards — **Passed**, **Failed**, **Total**, and **Duration** — use the same icons and colors described in [Reports (Test)](../test/reports.md#summary-cards).

| Card | What it shows |
|---|---|
| **Passed** | Number of check/assert steps that passed. Sub-label: pass rate (% of **passed + failed** steps only — skipped suite items do not lower the rate). |
| **Failed** | Number of steps that failed. Sub-label: fail rate (% of passed + failed steps). |
| **Total** | Number of check/assert steps executed so far (`passed + failed`). Sub-label: `N test file` or `N test files` — runnable tests and nested suites in the suite tree (not the step count). |
| **Duration** | Wall-clock suite run time. Sub-label: relative start time of the run. |

Passed and failed step counts include every check/assert from executed tests and nested suites (including partial subtree runs). Skipped items do not emit steps, so they are not included in Passed, Failed, or Total step counts.

Before the first run, the Overview section is hidden.

## Items tree

Below the overview and metadata blocks, the **Items** section groups runnable entries by execution stage. Use the **filter** control on the **Items** header to show **All**, **Passed**, **Failed**, **Skipped**, or **Errors** (ancestors of matching children stay visible). This is view-only — exports still include the full run.

Expand a test to see the same step **Report** list and status icons documented in [Reports (Test)](../test/reports.md#report-list). The nested **Report** list has its own **All / Passed / Failed** filter on the **Report** header.

Each item row also shows:

- A run-status icon ({{btn:pass}}, {{btn:error}}, {{btn:skip}}, {{btn:play-circle}}, and so on) — see [Step status icons](../test/reports.md#step-status-icons)
- A type icon (test, nested suite, mock server)
- {{btn:play}} **Run** for partial subtree execution

## Tag filter (runner)

When the suite file has `filter.only` and/or `filter.skip`, a read-only **Filter** block appears **below the Items tree** (not in the fixed header area with Environment and Servers):

| Row | Meaning |
|---|---|
| **Only:** | Active only-tags from `filter.only` |
| **Skip:** | Active skip-tags from `filter.skip` |
| **Total: N skipped** | After a run, how many suite items were skipped by the filter (shown only when `N > 0`) |

Edit tags in the {{btn:filter:Filter}} tab of [Edit Suite](./edit.md#filter). See [Tag filter](./execution.md#tag-filter).

## YAML warnings

When the suite YAML has parse errors, schema problems, or keys out of canonical order (including misplaced `filter:`), the run bar shows **YAML ERROR**. Click it to jump to the problem in the YAML editor. The runner keeps showing the last valid suite content until the file parses again.

Use {{btn:export:Export}} on the run bar to export the combined suite report. See [Exports](./exports.md) and [Report overview](../report/index.md).

---

See also: [Suite overview](./index.md) · [Report overview](../report/index.md) · [Execution](./execution.md) · [Reports (Test)](../test/reports.md)
