# SDD: Flowchart View for Tests and Suites

**Date:** 2026-05-12
**Status:** Proposed

---

## Summary

Add a **Flowchart** button next to the existing **Export** button in the test
and suite views. Clicking it opens a read-only, pan/zoom-able flow diagram of
the parsed test or suite, rendered with **React Flow**. Nodes represent every
construct the data model already exposes (start trigger, `call`, `assert`,
`check`, `set`, `sleep`/`delay`, control flow, sub-suites, etc.) and edges
connect them in execution order. Parallel branches fan out into multiple lines
from one node and fan back into the next node. Clicking a node jumps to the
corresponding line in the YAML source.

All flowchart-specific code lives in a new `mmtview/src/flowchart/` folder and
is structured for maintainability (pure graph-builder + presentational
components, no parsing logic in render code).

---

## Motivation

Today, understanding what a `.mmt` test or suite actually executes requires
reading YAML or stepping through the Flow tab. A visual flow diagram:

- Makes the order of operations obvious at a glance.
- Surfaces parallelism (stages, group entries) and branching (`if`/`else`)
  that are easy to miss in nested YAML.
- Mirrors common test-automation tools (Postman flows, n8n, Step CI's
  visualizers) where a graph view is part of the expected experience.
- Doubles as a lightweight documentation artifact when paired with the
  existing Export feature.

---

## Scope (v1)

In-scope:

- File types: `type: test` and `type: suite`.
- A "Flowchart" button rendered next to **Export** in both views.
- A new full-area view (toggled in-panel, not a separate webview panel) that
  renders the diagram. Toggling Off returns to the previous view.
- Read-only rendering with pan / zoom / fit-to-screen / minimap.
- Click-to-jump: clicking a node opens the **file** the node originates
  from via the existing `openRelativeFile` message. We do not track or
  navigate to specific lines in v1 — each node simply records the file
  path it came from.
- Auto-layout (left-to-right, matches the screenshot style).
- Parallel rendering: fan-out from a synthetic "parallel" anchor to N branches,
  fan-in to the next sequential node (diamond-like).

Out of scope (deferred):

- Live status overlays during runs.
- Editing the flow by manipulating the diagram.
- Exporting the diagram as PNG/SVG.
- Flowcharts for `type: api`, `type: server`, or `type: report`.

---

## UX

### Button placement

`ExportReportButton` is already rendered in three places relevant to v1:

- `mmtview/src/test/TestPanel.tsx` (Test view — currently only the Export
  button appears in the Test view; in the screenshot mock, the new button
  sits to its left).
- `mmtview/src/suite/test/SuiteTest.tsx` (Suite Test view).
- `mmtview/src/report/ReportPanel.tsx` (Reports — **not included** in v1).

A new sibling component `FlowchartButton` (a single icon button with the
`codicon-type-hierarchy-sub` or `codicon-git-merge` icon and label
"Flowchart") is placed immediately to the left of `ExportReportButton` in
the test and suite headers.

The header layout becomes:

```
[ title ............................. ]  [ Flowchart ]  [ Export ▼ ]
```

### View activation

The flowchart opens **inside the same panel** as a sub-page — the same
pattern used by the existing "Edit Test" mode in `TestPanel` (a
`api-swipe-root` / `api-swipe-track` slides the panel to a second page).

The second page has its own header with:

- A **back arrow** button (`codicon-arrow-left`) that returns to the
  previous page.
- A title ("Flow chart").
- The flowchart fills the remaining space.

Clicking the Flowchart button in the test/suite header swipes to the
flowchart page; the back button swipes back. No tabs or external panels
are introduced.

The sub-page state is local component state. We do **not** persist it to
`localStorage` (consistent with how Edit Test mode persists `page` but the
flowchart is conceptually a transient drill-down).

---

## Architecture

### Folder layout

```
mmtview/src/flowchart/
  index.ts                  // public re-exports
  FlowchartButton.tsx       // toolbar button (mirror of ExportReportButton style)
  FlowchartView.tsx         // top-level view: takes test|suite, renders ReactFlow
  graph/
    types.ts                // FlowNode, FlowEdge, FlowGraph, NodeKind
    buildTestGraph.ts       // TestData  -> FlowGraph
    buildSuiteGraph.ts      // SuiteBundle -> FlowGraph
    layout.ts               // dagre-based auto layout
  nodes/
    StartNode.tsx
    EndNode.tsx
    CallNode.tsx
    AssertNode.tsx
    CheckNode.tsx
    SetNode.tsx
    SleepNode.tsx
    IfNode.tsx
    LoopNode.tsx
    ParallelNode.tsx        // fan-out / fan-in anchor
    GroupNode.tsx           // suite groups
    SuiteNode.tsx           // imported suite
    TestRefNode.tsx         // test file reference inside a suite
    MessageNode.tsx         // generic "data" / inputs preview (matches screenshot 'message')
    nodeRegistry.ts         // kind -> React component
  __tests__/
    buildTestGraph.test.ts
    buildSuiteGraph.test.ts
```

Rules:

- Files in `flowchart/` MUST NOT import from `core/`'s execution path. They
  read from already-parsed `TestData` / `SuiteBundle` objects passed in via
  props.
- `graph/build*.ts` are pure functions, fully unit tested in `__tests__/`,
  zero React imports.
- React components in `nodes/` are presentational only; they receive a
  typed `data` prop.

### Data flow

```
TestPanel / SuiteTest
        │  test:TestData  |  bundle:SuiteBundle
        ▼
FlowchartView
        │
        ├─► buildTestGraph(test)  ── or ──  buildSuiteGraph(bundle)
        │           │
        │           ▼
        │     FlowGraph { nodes, edges }
        │           │
        │           ▼
        │     applyDagreLayout(graph) → positions
        │
        ▼
ReactFlow
   nodes=FlowNode[]  edges=FlowEdge[]  nodeTypes=nodeRegistry
```

### Graph model

```ts
// graph/types.ts
export type NodeKind =
  | 'start' | 'end'
  | 'call' | 'assert' | 'check' | 'set' | 'sleep' | 'print' | 'js'
  | 'if' | 'loop' | 'repeat'
  | 'parallel-fork' | 'parallel-join'
  | 'stage'
  | 'group' | 'suite' | 'test-ref' | 'message';

export interface FlowNode {
  id: string;
  kind: NodeKind;
  label: string;          // short title (e.g. "GET /users")
  detail?: string;        // single-line subtitle (e.g. URL, comparison expression)
  sourceFile?: string;    // file path to open on click
  meta?: Record<string, unknown>;
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  label?: string;         // 'then', 'else', 'after stage X'
  kind?: 'sequence' | 'branch-true' | 'branch-false' | 'parallel';
}

export interface FlowGraph {
  nodes: FlowNode[];
  edges: FlowEdge[];
}
```

### Builders

**`buildTestGraph(test: TestData): FlowGraph`**

1. Emit a single `start` node.
2. Walk `test.steps` (or each `test.stages[i].steps`) and emit one node per
   step using the mapping below. Connect previous → current with a
   `sequence` edge.
3. For `if`: emit an `if` node; recurse into `steps` (branch-true) and
   `else` (branch-false); join both branches into a single synthetic
   `join` node so the next sequential step has one inbound edge.
4. For `for` / `repeat`: emit a `loop` / `repeat` node, recurse into body,
   connect tail back to the loop header with a `parallel` style or
   "next iteration" label; loop exit edge continues to next sibling.
5. For `stages`: stages whose `after` lists share the same predecessor run
   in parallel — emit a `parallel-fork` after the common predecessor,
   render each parallel stage as its own subgraph, and merge with a
   `parallel-join` before the next sequential stage. Stages without
   `after` start from `start`.
6. End with an `end` node.

Step-kind to NodeKind mapping (driven by `getTestFlowStepType` from
`core/src/testParsePack.ts`):

| Step                  | NodeKind   | label             | detail                          |
|-----------------------|------------|-------------------|----------------------------------|
| `call`                | `call`     | `id` or `call`    | resolved interface / URL         |
| `assert`              | `assert`   | "assert"          | comparison expression            |
| `check`               | `check`    | "check"           | comparison expression            |
| `set`/`var`/`const`/`let` | `set`  | first key         | value preview                    |
| `delay`               | `sleep`    | "sleep"           | duration (e.g. "1.0s")           |
| `print`               | `print`    | "print"           | truncated text                   |
| `js`                  | `js`       | "js"              | first 40 chars                   |
| `if`                  | `if`       | "if"              | condition expression             |
| `for`                 | `loop`     | "for"             | iterator                         |
| `repeat`              | `repeat`   | "repeat"          | count                            |
| `data`                | `message`  | "data"            | csv alias                        |
| `setenv`              | `set`      | "setenv"          | key list                         |
| `run`                 | `call`     | "run"             | server alias                     |

**`buildSuiteGraph(bundle: SuiteBundle): FlowGraph`**

Walks `bundle.bundle` (the array of top-level groups):

1. Emit `start` → first group.
2. Within a group: emit a `group` node; its children (tests / sub-suites)
   become parallel branches fanning out from a `parallel-fork` and
   merging into a `parallel-join` (mirrors the runtime semantics where
   group children run in parallel).
3. Between groups: sequential edges (mirrors top-level sequential
   traversal between `then`-separated groups).
4. Sub-suites render as `suite` nodes; expanding them in-place is out of
   scope for v1 (label-only node, click-to-jump opens the suite file).
5. Tests render as `test-ref` nodes. (Drilling into a test's own flow is
   out of scope for v1.)
6. End with an `end` node.

Node `id`s reuse the existing bundle node `id` from
`core/src/suiteBundle.ts` so future status overlays can match runtime
events without remapping.

### Layout

Layout is implemented as a small custom **left-to-right walker** in
`graph/layout.ts`:

- Each node gets an `x` based on its rank (longest path from start).
- Siblings on parallel branches get stacked `y` offsets centered on the
  fork's `y`.
- Branches re-converge at the join node, which inherits the fork's `y`.

This avoids pulling in `dagre`. If layout quality becomes an issue we
can swap in `dagre` behind the same `applyLayout(graph)` interface
without touching builders or node components.

### React Flow integration

- Use `@xyflow/react` (v12, the React 19–compatible successor to
  `reactflow` v11). Add it to `mmtview/package.json`.
- Provide a custom `nodeTypes` map via `nodeRegistry.ts`. Each node
  component is a small functional component styled to match the
  screenshot palette: rounded card, **codicon** glyph in the accent
  color, small caps label, primary text, optional detail line.
- Enable `<Controls />` and `<Background variant="dots" />`. No minimap
  in v1.
- Disable node dragging and connection creation (read-only).
- Edges use the default smoothstep edge type with `animated: false`,
  dashed strokes (matches screenshot).

### Click-to-open

`FlowchartView` registers `onNodeClick`. Every node carries a
`sourceFile` (absolute or workspace-relative path). On click we call
the existing helper:

```ts
import { openRelativeFile } from '../vsAPI';
openRelativeFile(node.data.sourceFile);
```

This reuses the existing `openRelativeFile` round-trip (handled in
[src/mmtAPI/file.ts](../../src/mmtAPI/file.ts) by
`handleOpenRelativeFile`) so no new extension-host message is added.

- In a **test** flowchart, every step's `sourceFile` is the current
  test file (the panel passes its own path in).
- In a **suite** flowchart, group/suite/test nodes carry the bundle
  node's `path`. Clicking a test-ref node opens that test file;
  clicking a sub-suite node opens that suite file.

---

## Component contracts

```ts
// FlowchartButton.tsx
interface FlowchartButtonProps {
  active: boolean;
  disabled?: boolean;
  onToggle: () => void;
}

// FlowchartView.tsx
type FlowchartSource =
  | { kind: 'test'; test: TestData; rawYaml: string; filePath?: string }
  | { kind: 'suite'; bundle: SuiteBundle; rawYaml: string; filePath?: string };

interface FlowchartViewProps {
  source: FlowchartSource;
}
```

The host panel (`TestPanel`, `SuiteTest`) is responsible for:

- Owning the toggle state.
- Building the `SuiteBundle` (for the suite case) — it already does this
  for the run flow via `getSuiteHierarchy` + `createSuiteBundle`.
- Passing the already-parsed `TestData` for the test case.

This keeps `FlowchartView` ignorant of how its inputs were obtained.

---

## Suite-specific considerations

- The suite builder consumes a `SuiteBundle`, not the raw YAML, so it
  reuses the same `id` space as the suite run/tree views. This is
  important because it lets us later overlay run status using existing
  reporter events keyed by node id.
- `kind: 'missing'` and `kind: 'cycle'` bundle nodes render as
  `test-ref` nodes with an error badge and a tooltip describing the
  problem.
- `kind: 'server'` renders as a distinct `message`-styled node labelled
  "server (always-on)" with a dashed edge from `start` (so it's clear
  servers don't gate sequential progression).

---

## Testing

- `buildTestGraph.test.ts` covers: empty test, `steps`-only, `stages`
  with `after` chains and parallel siblings, nested `if`/`else`, `for`
  loops, mixed step kinds, and unknown step type fallback.
- `buildSuiteGraph.test.ts` covers: single group, multiple groups,
  nested sub-suite, `missing`/`cycle` nodes, group with one entry
  (no fan-out), and the `servers` field.
- Layout is not unit-tested (depends on dagre); we add a single
  smoke test that the layout step assigns every node an `(x, y)`.
- A React Testing Library smoke test renders `FlowchartView` with a
  small `TestData` and asserts that the expected node labels appear.

---

## Performance

- Graphs are built synchronously on demand. Even large tests yield
  graphs on the order of dozens of nodes; React Flow handles thousands
  comfortably, so no virtualization is needed.
- Builders memoize on the parsed input reference. `FlowchartView`
  uses `useMemo` to avoid recomputing on unrelated re-renders.

---

## Migration / rollout

- No data-model changes — purely additive UI.
- No CLI changes.
- Documentation: add `docs/flowchart-view.md` describing the button and
  what each node kind means. Link from `docs/test-mmt.md` and
  `docs/suite-mmt.md`.

---

## Resolved questions

- **Pattern**: in-panel swipe sub-page with back button (matches Edit
  Test mode), not a separate webview.
- **Icons**: codicons.
- **Click target**: file only (no line). Each node stores its
  originating file path; click invokes `openRelativeFile`.
- **No effect on existing code paths**: the new feature is purely
  additive — a new button in the test/suite headers and a new swipe
  page. No existing components or message handlers are modified beyond
  the minimal header additions and the swipe wrapper.

---

## Future work

- Live run overlay: subscribe to `runFileReport` events and color
  nodes with running/passed/failed states. The bundle-id reuse in
  `buildSuiteGraph` already makes this straightforward for suites.
- Drill-down: clicking a `suite` or `test-ref` node loads the target
  file's graph in place (breadcrumb to return).
- Export diagram as PNG/SVG (extend the Export menu).
- Inline editing: drag-to-reorder steps in the diagram, persist back to
  YAML.
