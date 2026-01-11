# SDD: Suite imported-node run fixes

Date: 2026-01-10

## Problem

Current suite tree "per-node run" behavior has four user-visible issues:

1. **False pass**: some tests show as passed while an assertion/check inside the test failed (and is reported).
2. **No run button for imported nodes**: tests/suites inside imported suites cannot be run from the right-side Run buttons.
3. **Imported suite run behaves like "run file"**: running an imported suite node runs that suite file in isolation; the UI does not treat it as a run scoped to that node within the parent suite hierarchy.
4. **Wrong target selection**: when two tests are imported, clicking Run on the second runs the first.

## Goals

- Enable Run buttons for *all runnable nodes* in the suite tree, including imported suite/test nodes.
- A node run must be **scoped to the clicked node** but still reported back **under the parent suite hierarchy**.
- Fix selection so clicking a node runs exactly that node (or its subtree).
- Fix run pass/fail aggregation so a reported failing check results in a failed run state.

## Non-goals

- Full "suite bundle" execution engine (covered by `SDD-suite-bundle-run.md`).
- Changing core YAML semantics of suite files.

## Current implementation summary

- Webview sends `runSuite` with `targets: string[]`.
- Extension filters the *root suite YAML* using `src/mmtAPI/suiteTargets.ts`.
- `targets` accept only `testId` in `${groupIndex}:${groupItemIndex}` format.
- Imported nodes are rendered with `leafId = import:${parent}:path:${path}` (not `${gi}:${ei}`), and run buttons are disabled for them.

This means imported nodes never participate in targeting, and they also reuse IDs that can collide or be incorrectly mapped.

## Design

### 1) Introduce a stable `nodeId` for the suite tree nodes

- For top-level suite entries, `nodeId` can remain `${gi}:${ei}` (compatible with existing `testId`).
- For imported nodes, compute a deterministic `nodeId` based on *structural position* rather than raw path:
  - Example: `root:0/child:1/child:0`
  - This prevents "same path reused" collisions and fixes the "second runs first" bug.

We already have a core-side builder in `core/src/suiteBundle.ts` that assigns structural ids; this SDD scopes using the same `nodeId` concept for UI targeting.

### 2) Webview-to-extension protocol

Change `runSuite` message to allow:

- `targets: string[]` where each entry is a `nodeId`.

The extension must:

- If all targets match `^\d+:\d+$`, use the existing `buildFilteredSuiteYaml` fast-path (back-compat).
- Otherwise, run suite in **node-scoped mode**:
  - Build suite hierarchy from the root suite.
  - Build a bundle (`SuiteBundle`) and compute the set of runnable leaf `nodeId`s under each target.
  - Execute only those leaf nodes, but report events with `nodeId` so the UI can route them.

This is a stepping stone towards the full bundle runner.

### 3) UI: enable run buttons for imported nodes

- In `mmtview/src/suite/test/SuiteTestTree.tsx`, treat any `leafId` / `nodeId` as runnable, not only `${gi}:${ei}`.
- Pass `onRunTargets([nodeId])` for imported test and imported suite nodes.
- Group run continues to map to top-level groups only.

### 4) Reporting correctness (false pass)

The UI "passed" state must be derived from **final run summary** rather than partial step events:

- `test-step` events that contain an explicit failure must mark the run as failed.
- Additionally, when `test-step-run` summary has `success: false`, the run must be failed.

If there is a mismatch today, fix the reducer that maps `runFileReport` events to `leafRunStateByLeafId`.

## Implementation plan

1. Add `nodeId` to suite tree nodes (webview) and ensure uniqueness.
2. Update UI run buttons to emit `targets` (nodeIds) for imported nodes.
3. Update extension `handleRunSuite` to accept nodeId-style targets.
4. Fix report routing to prefer `nodeId` over `testId` over legacy `leafId`.
5. Fix pass/fail aggregation in webview state reducer.
6. Add regression tests:
   - UI-level pure tests for target selection uniqueness.
   - Core tests for bundle nodeId determinism (already exists) plus mapping target->leaf set.

## Test plan

- Unit tests:
  - Add a test around suite tree id generation when the same file path appears twice.
  - Add a test that clicking second imported node yields a distinct target.
  - Add a test for run-state reducer: a failing `check` event forces `failed`.

- Manual:
  - Open a suite importing another suite with two tests.
  - Verify run buttons exist on imported items.
  - Run an imported test and confirm only that test runs.
  - Introduce a failing check and verify run state is failed.
