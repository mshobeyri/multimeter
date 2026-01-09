# SDD: Suite Test Reports (per-test panels)

## Goal
When running a suite in the webview, show a per-test report panel under each test row (same UI as `mmtview/src/test/TestTest.tsx`).

Requirements:
- Report UI is shown by expanding a test row (and auto-opens on failures).
- Reports are reset at the start of each suite run.
- Duplicate test files can appear multiple times; routing must be per *instance*.
- Support stopping a running suite.
- Design must support future “run this specific item only”.

Non-goals (for this iteration):
- Persisting report history across multiple suite runs.
- Aggregating nested imported suite reports into parent summary.

## Key idea: `testKey` (Option A)
We introduce a suite-scoped, instance-stable identifier `testKey` for each visible test item produced from a suite file.

- `testKey` is computed in the webview from the suite tree structure and is stable as long as the suite YAML ordering (group index/entry index) remains stable.
- For imported children, `testKey` includes the import-chain segment so duplicates remain distinct.

The UI and the extension use the same `testKey` during a suite run to route `runFileReport` events to the corresponding panel.

## Data model
### Webview tree item data
Extend test-row (`file` / `import-file`) item data:
- `testKey: number` (unique within the suite file *run scope*)
- `suiteFilePath: string` (the parent suite file the run originated from)
- `subFilePath: string` (path of the test file)

### Run commands
Webview → extension (new/extended commands):
- `runSuite`:
  - `suiteFilePath: string`
  - `suiteRunId: string`
  - `targets?: Array<{ testKey: number; subFilePath: string }>` (optional; for future “run item only”)
- `stopSuiteRun`:
  - `suiteRunId: string`

### Report events (extension → webview)
Extend `runFileReport` payload for suite runs:
- `suiteRunId: string`
- `testKey: number`
- `parentFilePath: string` (suite file)
- `subFilePath: string` (test file)

Existing fields stay as-is:
- `command: 'runFileReport'`
- `scope: 'test-step' | 'test-step-run' | 'test-finished' | ...`
- `runId: string` (kept; can be either suiteRunId or underlying runner runId)
- step fields: `stepIndex`, `stepType`, `status`, `comparison`, `details`, etc.

Backward compatibility:
- For non-suite runs (`runCurrentDocument`), these new fields are omitted.

## Report routing in webview
Maintain a store:
- `suiteRunId` → `Map<testKey, { runState, stepReports, expandedDetails }>`

Rules:
- On `runSuite` start: clear all report state and set current `suiteRunId`.
- On `runFileReport` with matching `suiteRunId`:
  - Append `test-step` reports to that `testKey`.
  - Update per-test `runState`.
  - If a `failed` step arrives, auto-expand that test’s report panel.

## Stop suite
- Webview sends `stopSuiteRun(suiteRunId)`.
- Extension cancels the suite execution token.
- Cancellation stops further report emission.
- Webview marks running tests as `idle` or `cancelled`.

## Testing
Unit tests:
- `suiteHierarchy` unit tests already validate “single group → no group wrapper”.
- Add tests for deterministic `testKey` assignment for base and imported nodes.
- Add tests for report routing reducer: events update correct `testKey` only.

Integration smoke:
- Run a suite with duplicated test file paths; verify separate report panels.

## Implementation breakdown
1) Webview: compute and attach `testKey` onto each test item (base + imported nodes).
2) Webview: implement per-test report panel component (extract from `TestTest.tsx` into reusable `TestReportPanel`).
3) Extension: implement `runSuite` command handler, execute suite sequentially, and emit report events tagged with `{ suiteRunId, testKey }`.
4) Extension: implement `stopSuiteRun` cancellation.
5) Wire tree rows to expand/collapse report panel and auto-open on failure.

