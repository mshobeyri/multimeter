# SDD: Single-target Suite Bundle

## Overview
Suite runs currently support partial execution via `suiteTargets: string[]` and/or a bundle runner that filters runnable leaves. This SDD replaces that model with a **single-target suite bundle**:

- The suite is represented as a tree of nodes with **`kind`**, **`id`**, and **`children`**.
- A run is driven by a single **`target`** id.
- Executing a suite bundle means: **treat the target node as the root**, and run its runnable descendants.
- Reporting and routing use **only `id`** (no `leafId` and no backward compatibility).

This change is a breaking change across core, extension host, and webview.

## Goals
- One canonical suite execution structure: `SuiteBundle`.
- Targeting is a single id (`target`), not a list.
- Execution is subtree-based: run “as if target is the suite root”.
- Reporter payloads include `id` for routing.
- Remove `runnableLeafIds` and `suiteTargets`.
- Add unit tests for bundle creation and subtree execution.

## Non-goals
- Backwards compatibility with `suiteTargets`, `leafId`, `nodes`, `runnableLeafIds`.
- Multi-target runs.

## Data Model

### Node kinds
`kind` drives behavior:
- `group`: logical grouping node, non-runnable itself; runs its children.
- `suite`: runnable node that points to a child suite file (`path`). When executed, its file is run through `runner.runFile`.
- `test`: runnable node that points to a test file (`path`). When executed, its file is run through `runner.runFile`.
- `missing`: non-runnable node representing a missing file.
- `cycle`: non-runnable node representing a detected import cycle.

### Types (TypeScript)
```ts
export type SuiteBundleNodeKind = 'group' | 'suite' | 'test' | 'missing' | 'cycle';

export type SuiteBundleNode =
  | { kind: 'group'; id: string; label: string; children: SuiteBundleNode[] }
  | { kind: 'suite'; id: string; path: string; children: SuiteBundleNode[] }
  | { kind: 'test'; id: string; path: string }
  | { kind: 'missing'; id: string; path: string }
  | { kind: 'cycle'; id: string; path: string };

export interface SuiteBundle {
  rootSuitePath: string;
  bundle: SuiteBundleNode[];
  target?: string;
}

export function createSuiteBundle(params: {
  rootSuitePath: string;
  hierarchy: SuiteHierarchyNode[];
  target?: string;
}): SuiteBundle;
```

## Bundle creation (`createSuiteBundle`)
- Input: `rootSuitePath`, suite hierarchy, optional `target`.
- Output: `SuiteBundle`.

### ID generation rules
- For runnable suite/test nodes, prefer `hierarchyNode.leafId` if present.
- Otherwise generate a deterministic id based on **structural position**:
  - Root prefix: `suite:${rootSuitePath}` (sanitized)
  - Append a path segment per child index in the hierarchy traversal.
  - Include kind and path/label for stability.

This keeps ids deterministic across runs given the same hierarchy.

## Execution (`executeSuiteBundle`)

### Selecting the root
- If `bundle.target` is provided:
  - Find the node with `id === target` anywhere in `bundle.bundle`.
  - If not found: **throw** with a descriptive message.
  - Run using that node as root.
- If `bundle.target` is not provided:
  - Run using the top-level `bundle.bundle` array as root (equivalent to “run all”).

### Subtree semantics
- If root is `test` → execute that test.
- If root is `suite` → execute that suite file.
- If root is `group` → execute all runnable descendants under it.
- If root is `missing` or `cycle` → throws (or reports failed) since it’s not runnable.

### Execution strategy
- Traverse the selected root subtree.
- For each encountered `suite` or `test` node:
  - Resolve `node.path` relative to `bundle.rootSuitePath`.
  - Load raw file via `options.fileLoader`.
  - Call `runFile({...options, fileType:'raw', file: childRawText, filePath: childFilePath, leafId: undefined, id: node.id })`.
  - Reporter events include `id: node.id`.

### Reporter format
- `suite-run-start` / `suite-run-finished` include `suitePath` and totals.
- `suite-item` includes:
  - `id` (required)
  - `runId`, `filePath`, `entry`, `docType`, and `status`.

All test step events should also include `id` so UI can route logs.

## Public API changes
- Remove `suiteTargets?: string[]` from `RunFileOptions`.
- Replace all `leafId` occurrences in reporter events with `id`.

## VS Code extension changes
- Webview message changes: `runSuite` now sends `{ target: string }` (optional: absent means run all).
- Extension builds suite hierarchy from the current suite file.
- Extension calls `createSuiteBundle({ rootSuitePath, hierarchy, target })` and passes it to `runner.runFile({ suiteBundle })`.

## Webview changes
- Tree nodes use `id` and `children`.
- Run buttons send a single `target`.
- Output routing uses `id`.

## Tests

### Unit tests for `createSuiteBundle`
- Empty hierarchy → bundle empty.
- Hierarchy with groups/suites/tests → ids and children stable.
- Preserve runnable ids when provided by hierarchy leafId.
- Target is set and preserved.

### Unit tests for `executeSuiteBundle`
- Target suite node runs only subtree under that suite.
- Target test node runs that test only.
- Missing target throws.
- Missing/cycle nodes handled (throw or mark failed).

## Rollout
Breaking change in one release:
- Update core + extension + webview in lock-step.
- Update docs referencing `suiteTargets` / `leafId`.
