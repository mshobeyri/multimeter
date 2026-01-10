# SDD: Core Suite Bundle Run (Recursive, solid reporting)

Date: 2026-01-10

## Problem
We need “solid” reporting for suites that import other suites recursively, and we need explicit suite lifecycle reporting (suite started/finished) so the UI (and also CLI/assistant) can reliably:

- Run a suite as a file via the existing path (`runner.runFile` on the suite YAML).
- Run a suite as a **bundle** where each visible step/node has a stable ID, and that ID is returned on every report event so the UI can update the correct node.

Today:
- `core/src/runSuite.ts` runs entries and emits `scope: 'suite-item'` with `testId` computed as `${groupIndex}:${groupItemIndex}`.
- Nested imported suite items do not get their own stable IDs in core; UI can only route nested events to a top-level `testId`.
- Suite lifecycle events (whole suite start/finish) are not explicit; consumers rely on ad-hoc logs.
- “Targets filtering” (subset run) is implemented in the extension by building a filtered suite YAML string.

We want a core-native approach that works the same way for VS Code, CLI, and assistant.

## Goals
1) **Keep existing behavior**: `runner.runFile` can run any suite file (type: suite) with the current semantics.
2) Add a **new execution mode**: run a suite bundle produced from `suiteHierarchy` (or compatible data) that:
   - Assigns a stable `nodeId` to each runnable node (test/suite entry) including nested imported suites.
   - Propagates `nodeId` into all child `test-step` / `test-step-run` / `suite-item` reports.
3) Add explicit suite lifecycle events:
   - `suite-run-start`
   - `suite-run-finished`
   - (optional) `suite-run-cancelled`
4) Add unit tests for bundle creation to ensure deterministic IDs and correct ordering.
5) Keep `core` platform-neutral; do not import VS Code or `fs`.

## Non-goals (v1)
- Parallel execution of suite items.
- UI rendering changes (except consuming new report scopes/fields).
- Replacing the current extension filtering approach immediately.

## Proposed API surface (core)

### New data model: `SuiteBundle`
Located in `core/src/suiteBundle.ts`.

```ts
export type SuiteBundleNodeKind = 'group' | 'suite' | 'test' | 'missing' | 'cycle';

export interface SuiteBundleNodeBase {
  nodeId: string;           // stable within the bundle
  kind: SuiteBundleNodeKind;
  label?: string;           // group label or display name
  path?: string;            // file path for suite/test entries
  children?: SuiteBundleNode[];
  parentNodeId?: string;
}

export type SuiteBundleNode =
  | (SuiteBundleNodeBase & { kind: 'group'; children: SuiteBundleNode[] })
  | (SuiteBundleNodeBase & { kind: 'suite'; path: string; children: SuiteBundleNode[] })
  | (SuiteBundleNodeBase & { kind: 'test'; path: string })
  | (SuiteBundleNodeBase & { kind: 'missing'; path: string })
  | (SuiteBundleNodeBase & { kind: 'cycle'; path: string });

export interface SuiteBundle {
  rootSuitePath: string;
  nodes: SuiteBundleNode[];           // top-level nodes (groups or items)
  runnableLeafIds: string[];          // nodeIds of runnable leaves (test nodes and suite nodes)
}
```

### Bundle builder
Builds a `SuiteBundle` from `suiteHierarchy` nodes.

- Input: `SuiteHierarchyNode[]` from `core/src/suiteHierarchy.ts`.
- Output: `SuiteBundle`.
- Rules:
  - Deterministic `nodeId` based on the structural position and file path.
  - Proposed `nodeId` format:
    - `g:<groupIndex>` for group nodes
    - `i:<groupIndex>:<itemIndex>` for top-level items
    - Nested items get a path segment, e.g. `i:0:2/s:0/i:1` (suite child ordering)
  - `missing` and `cycle` nodes are not runnable.

### New runner: `runSuiteBundle`
Located in `core/src/runSuiteBundle.ts`.

Signature:

```ts
export async function runSuiteBundle(params: {
  bundle: SuiteBundle;
  options: RunFileOptions;
  runFile: (options: RunFileOptions) => Promise<RunFileResult>;
}): Promise<RunFileResult>;
```

Key behaviors:
- Emits lifecycle reports:
  - `scope: 'suite-run-start'` with `{ runId, suitePath, startedAt, totalRunnable }`
  - `scope: 'suite-run-finished'` with `{ runId, suitePath, finishedAt, success, durationMs }`
- Emits per-node progress:
  - Reuse `scope: 'suite-item'` but add `nodeId` (and keep legacy `testId`).
- Propagates `nodeId` into children:
  - Pass `testId` (existing) and also `nodeId` through `RunFileOptions`.
  - Ensure `test-step` and `test-step-run` events carry `nodeId`.

## Reporter/event shape changes
Update `core/src/runConfig.ts`:
- Add `nodeId?: string` to:
  - `TestStepReporterEvent`
  - `TestRunSummaryEvent`
  - `SuiteReporterMessage`
- Add new union members:

```ts
export interface SuiteRunStartEvent {
  scope: 'suite-run-start';
  runId: string;
  suitePath?: string;
  startedAt: number;
  totalRunnable: number;
}

export interface SuiteRunFinishedEvent {
  scope: 'suite-run-finished';
  runId: string;
  suitePath?: string;
  finishedAt: number;
  success: boolean;
  durationMs: number;
  cancelled?: boolean;
}
```

And extend `RunReporterMessage` union accordingly.

## Integration points

### VS Code extension
- Continues to support `runSuite` via `runner.runFile` for “run suite file”.
- Adds a new command/message (v2): `runSuiteBundle` that:
  - requests suite hierarchy from `core` (or uses cached hierarchy already computed in webview),
  - sends a serialized bundle to extension,
  - extension calls core `runSuiteBundle` and forwards reports by `nodeId`.

### CLI and assistant
- Both can run suites in either mode:
  - classic: `runner.runFile` on suite YAML
  - bundled: build hierarchy → build bundle → `runSuiteBundle`

## Testing plan
Add unit tests for bundle creation:
- Deterministic `nodeId` assignment for:
  - single suite with tests
  - suite importing another suite
  - duplicate test paths appearing in multiple locations
  - cycle and missing nodes (non-runnable)
- Ordering preserved: bundle runnable leaf order matches visible tree order.

## Open questions
1) Should `nodeId` be purely structural (stable under reformat but changes on insertion) or content-based (hash of import chain + path)?
2) Should bundled suite run support “run subtree from nodeId” (targets) in core?
3) Do we keep `testId` for anything beyond top-level compatibility?
