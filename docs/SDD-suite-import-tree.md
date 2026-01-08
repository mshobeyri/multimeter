# SDD: Suite Test Import Tree (Recursive)

Date: 2026-01-08

## Goal
Enhance the Suite panel (Test tab) to show a **recursive import tree** for each suite entry.

- Suite panel already has two tabs:
  - **Edit**: edit suite `tests:` list/tree
  - **Test**: run suite + show results (read-only)

This SDD covers the *next step*: in **Test** tab, expand each entry to display imported children recursively.

## User Stories
1. As a user, in **Suite Test**, I can expand a suite entry to see what it imports.
2. If an entry points to a **suite** (`type: suite`), I can expand it to see its `tests:` entries as children (and recurse).
3. If an entry points to a **test** (`type: test`), I can expand it and see a **test-run box** like the existing running-tests UI, so the report from that test is shown inside that box during run.
4. Imported vs non-imported distinction does not matter; we only build the tree until reaching leaf tests.

## Non-goals / Out of scope (for now)
- Editing imported child entries from within Suite Test.
- Deduplicating the same file appearing multiple times (optional later).
- Preventing cycles (we will handle to avoid infinite recursion, but not do fancy UI for cycles initially).

## UX / UI Requirements
- Tabs:
  - Same tab styling as `TestPanel` (icon + responsive icon-only mode). Done.
- In **Edit** tab:
  - Remove status icons per group (run status). Done.
- In **Test** tab:
  - Do not render file paths as editable inputs; show file path as a label. Done.

### New: Import Tree UI (Test tab)
- Each suite file entry becomes an expand/collapse parent if it can be resolved to a `.mmt` file.
- Child nodes reflect discovered imports:
  - If the resolved file is `type: suite`, children are its `tests:` entries (strings) grouped by `then` (same as current group model).
  - If the resolved file is `type: test`, it is a leaf node that renders a **TestRunBox** UI.

### “Three view” requirement
You mentioned: "Same three view to test the suite".
Current suite tree already has:
- root
- group
- file

Recommendation: keep those three levels, and represent imported content as additional tree depth:
- file (suite entry)
  - imported suite group(s) / directly imported items
  - leaf test boxes

Question: do you want to keep the `then` grouping visual inside imported suites (i.e. show Group 1/Group 2 nodes), or flatten imported suite children under the suite node?

## Data/Message Flow
We need file contents to resolve imports.

### Option A (recommended): reuse existing extension API `validateImports`
- Webview posts `validateImports` with `{ includeInputs: false, includeSuites: true }` (new flag).
- Extension reads the candidate file paths relative to current document, parses them (via core), and returns:
  - file type: `suite|test|api|env|doc|unknown`
  - for suites: extracted `tests` entries
  - for tests: extracted structural info needed for rendering the “test-run box” (or we just store file path and let run events fill results)

### Option B: webview-only parsing
- Webview cannot read imported files; must ask extension anyway. So not viable.

So we need a **new/extended message** from extension to provide import graph details.

## Proposed Types
Add lightweight type in `mmtview/src/suite/types.ts` (or new `importTreeTypes.ts`):

```ts
export type SuiteImportNode = {
  id: string;            // stable in-session id
  path: string;          // relative path as in suite entry
  resolvedPath?: string; // normalized path (if available)
  kind: 'missing' | 'suite' | 'test' | 'other';
  children?: SuiteImportNode[];
};
```

For leaf test nodes we also need:
- `groupIndex` / `groupItemIndex` or an execution key so we can route `runFileReport` events into the correct box.

Recommendation: use a stable "run key":

```ts
type SuiteRunKey = `${rootSuitePath}::${nodeResolvedPath}`;
```

Or carry `{rootGroupIndex, rootItemIndex, nestedPathChain}`.

## Execution / Reporting
Today, run reporting is keyed by:
- `groupIndex`
- `groupItemIndex`

This works only for top-level suite entries.

To support nested test boxes, we need either:
1) Extension to emit richer run events including the path of the test file being run, OR
2) SuiteTest UI to only show detailed boxes for top-level entries (and nested nodes are informational).

Question: when you say "reports from that specific test will be shown in it during run" — do you want that for nested tests too, or only for top-level suite entries?

If **nested too**, I recommend extending the event payload:
- Add `filePath` (or `suiteItemPath`) to `runFileReport` message.
Then the UI can route to the right node by matching paths.

## Algorithm
Given root suite document path `root` and its `tests:` list:

1. For each suite entry path `p`:
   - Ask extension to resolve metadata for `p`.
2. If `p` resolves to `type: suite`:
   - Extract its `tests:` list, create children nodes.
   - Recurse for each child entry.
3. If `p` resolves to `type: test`:
   - Leaf node.
4. Maintain a `visited` set keyed by resolved absolute path to prevent infinite loops.

## Performance / Caching
- Cache results per resolved path for the session.
- Recompute when:
  - root suite content changes
  - or when user expands a node (lazy fetch)

Recommendation: do **lazy expansion**: only fetch/parse imports when the user expands a node.

## Open Questions
1. **Grouping**: Show imported suite groups (Group 1/2) or flatten?
2. **Run reporting routing**: Do you want nested test boxes to receive live run reports?
3. **Depth limit**: Any maximum recursion depth (default: 10)?
4. **Duplicates**: If the same test appears multiple times, render multiple nodes or merge?

## Implementation Plan
1. Extension: add new request/response for suite import metadata.
2. Core: reuse parsing (`parseYaml`) only for identifying `type` and reading `tests`.
3. Webview:
   - Maintain `SuiteImportNode` tree state per top-level entry.
   - Add expand/collapse UI.
   - Render leaf test nodes using the existing Test run box component.
4. Wire run events to leaf nodes (if needed).

