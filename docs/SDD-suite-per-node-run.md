# SDD: Suite Tree Per-Node Run + `testId` Reporting

Date: 2026-01-10

## Summary
Add the ability to run individual steps in the suite hierarchy tree (group, suite, test nodes) via a right-aligned Run button on each node. Ensure that reports emitted during suite runs include a stable identifier called `testId` so the webview can reliably attribute progress and step reports to the correct node. The core runner (JSer/test execution) must emit `testId` for both suite-item start/end and nested test-step events so downstream consumers (VS Code + CLI) stay consistent.

This change is implemented with minimal disruption:
- Reuse existing suite execution pipeline (`runner.runFile` with the currently-open suite document).
- Extend the webview → extension `runSuite` message to optionally include a target subset.
- Have the extension build a filtered suite YAML (containing only targeted entries) and execute that.
- Add `testId` to `runFileReport` messages (aliasing existing `leafId`) and update the webview to route by `testId`.

## Goals
- Add a Run button for:
  - Group nodes: run all entries in the group.
  - Top-level suite entries: run only that entry.
  - Top-level test entries (non-suite): run only that entry.
  - Imported/nested nodes (from suite hierarchy): run the nearest top-level parent entry (v1).
- Use `testId` as the stable, report-routing identifier, emitted directly from `core` (suite + test runners, i.e., JSer pipeline).
- Allow the extension to execute only the targeted subset without mutating the original document on disk, via an in-memory filtered suite builder.

## Non-goals (v1)
- True “deep” imported node execution (running a nested test inside a nested suite without running the parent top-level suite entry).
- Cancellation semantics inside `core` (extension already supports stop-by-not-forwarding + abort signal).

## Current Behavior (Baseline)
- Webview renders `SuiteTestTree` with a hierarchy of:
  - Root → Group → Entry nodes.
  - Entries become either `test` or `suite` once hierarchy detection resolves.
- Webview has a Run Suite action that posts `{ command: 'runSuite', suiteRunId, inputs }`.
- Extension handles `runSuite` and calls `runner.runFile({ file: document.getText(), filePath, ... reporter })`.
- Extension derives a stable per-entry routing key for suite runs:
  - `leafId = "${groupIndex}:${groupItemIndex}"` for `scope: 'suite-item'` reporter messages.
  - Maps nested test-step runs using `runId → leafId`.
- Webview routes per-entry step reports using `leafId`.

## Proposed Changes

### 1) Core-level `testId`
- Extend `RunFileOptions`, `SuiteReporterMessage`, `TestStepReporterEvent`, and `TestRunSummaryEvent` with optional `testId`.
- `runSuite` (core) computes `${groupIndex}:${groupItemIndex}` and:
  - Adds `testId` to every `suite-item` event.
  - Passes `testId` down to child `runFile` calls so nested `test-step` and `test-step-run` events include it.
- `runTest` attaches `testId` to each emitted step + summary event before forwarding to the shared reporter.
- `jsRunner` / `testHelper` expose `testId` via globals so user-authored helpers can still emit consistent metadata when bypassing `runTest` wrappers.

### 2) In-memory suite filtering helper
- Extract a pure helper (`buildFilteredSuiteYaml`) that:
  - Parses the current suite YAML.
  - Splits groups respecting `then` barriers.
  - Rebuilds `tests` containing only targeted `testId`s, re-inserting `then` between surviving groups.
  - Returns the original suite text when input is invalid or no targets match.
- Cover the helper with unit tests (Jest) to ensure only the selected entries remain.
- `handleRunSuite` uses this helper whenever `message.targets` is provided.

### 3) Per-node Run buttons + group support
- Add explicit Run buttons (icon + “Run” label) to suite, test, and group rows, ensuring they’re visible and do not toggle tree expansion.
- For imported child nodes, first version delegates to the nearest top-level parent (matching `testId`).

### 4) Webview/extension message contract
- `runSuite` message takes optional `targets: string[]` (array of `testId`s).
- `runFileReport` messages now always include `testId` (forwarded from core); `leafId` stays for backward compatibility but is deprecated.
- Webview state stores/reporting keyed by `testId`.

### 5) Tests
- New tests for the suite filtering helper and core reporter plumbing guarantee regressions are caught.
- Update existing suite leaf routing tests if needed to assert the UI prefers `testId`.

## Data Model / IDs

### `testId`
- For top-level suite entries: `${groupIndex}:${groupItemIndex}`.
- Propagates through `runSuite` → child `runFile` → JS reporter so every event (suite-item + test-step) has the same `testId`.
- Imported/nested nodes map back to their top-level ancestor `testId` in the current version.

## UX / UI
- Run button appears on the far right of the node row.
- Disabled states:
  - Disabled if file is missing or suite is currently running (optional, but recommended v1).
- Tooltip:
  - `Run` / `Run group`.

## Files / Implementation Locations
- Extension:
  - `src/mmtAPI/run.ts`: suite run handler; add `testId` to `runFileReport` payload. (Done.)
  - `src/mmtAPI/run.ts`: accept `targets` and build filtered suite content before calling `runner.runFile`.

- Webview:
  - `mmtview/src/suite/test/SuiteTest.tsx`: message handler; route by `testId` (fallback `leafId`).
  - `mmtview/src/suite/test/SuiteTestTree.tsx`: pass `testId`/target metadata into row components.
  - `mmtview/src/suite/test/SuiteTestGroupItem.tsx`: render right-side Run button.
  - `mmtview/src/suite/test/SuiteSuiteFileItem.tsx`: render right-side Run button.
  - `mmtview/src/suite/test/SuiteTestFileItem.tsx`: render right-side Run button.

## Testing
- Unit tests (webview):
  - Extend `mmtview/src/suite/test/suiteLeafRouting.test.ts` to verify that `testId` routes correctly and that fallback to `leafId` remains.
- Manual:
  - Open a suite `.mmt`.
  - Expand the tree.
  - Click Run at group/entry levels and confirm only that scope runs.
  - Validate reports/step panels attach to correct entries.

## Rollout / Migration
- Phase 1 (this change):
  - Extension emits both `leafId` and `testId`.
  - Webview consumes `testId` preferentially.
- Phase 2 (later cleanup):
  - Remove `leafId` usage in webview.
  - Optionally stop emitting `leafId`.
