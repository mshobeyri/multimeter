import { TestData } from 'mmt-core/TestData';
import { SuiteGroup } from '../../suite/types';
import { SuiteTreeNode } from '../../suite/test/suiteHierarchy';
import { appendGraph, inlineTestGraph } from './inlineTestGraph';
import { FlowGraph } from './types';

export interface BuildSuiteGraphInput {
  rootTitle?: string;
  rootPath?: string;
  groups: SuiteGroup[];
  /** Resolved hierarchy keyed by entry path. */
  hierarchyByEntryPath?: Record<string, SuiteTreeNode | undefined>;
  /** Set of missing file paths. */
  missingFiles?: Set<string>;
  /** Parsed TestData by absolute path for inlining test flows. */
  testDataByPath?: Record<string, TestData | undefined>;
}

/**
 * Top-level suite graph.
 *
 * Semantics (matches runtime):
 *   START → [group_1 entries in parallel] → [group_2 entries in parallel] → END
 *
 * Each test entry is rendered as a header node followed by its inlined flow
 * (from `buildTestGraph`). Sub-suites are walked recursively. Entries with
 * no resolved test data are rendered as a header-only node.
 */
export function buildSuiteGraph(input: BuildSuiteGraphInput): FlowGraph {
  const graph: FlowGraph = { nodes: [], edges: [] };
  const ctx = new BuildCtx(input);

  const startId = 'sn-start';
  graph.nodes.push({
    id: startId,
    kind: 'start',
    label: input.rootTitle || 'START TRIGGER',
    sourceFile: input.rootPath,
  });

  let previousTails: string[] = [startId];

  for (const group of input.groups ?? []) {
    if (!group?.entries?.length) {
      continue;
    }
    const groupNodeId = ctx.nextId('group');
    graph.nodes.push({
      id: groupNodeId,
      kind: 'group',
      label: group.label,
      sourceFile: input.rootPath,
    });
    for (const t of previousTails) {
      ctx.connect(graph, t, groupNodeId);
    }

    const groupTails: string[] = [];
    for (const entry of group.entries) {
      const hierarchy = input.hierarchyByEntryPath?.[entry.path];
      const tails = buildEntry(graph, ctx, entry.path, hierarchy, [groupNodeId]);
      groupTails.push(...tails);
    }
    previousTails = groupTails.length > 0 ? groupTails : [groupNodeId];
  }

  const endId = 'sn-end';
  graph.nodes.push({
    id: endId,
    kind: 'end',
    label: 'END POINT',
    sourceFile: input.rootPath,
  });
  for (const t of previousTails) {
    ctx.connect(graph, t, endId);
  }

  return graph;
}

class BuildCtx {
  private counter = 0;
  private edgeCounter = 0;
  constructor(public readonly input: BuildSuiteGraphInput) {}
  nextId(prefix: string): string {
    this.counter += 1;
    return `sn-${prefix}-${this.counter}`;
  }
  connect(graph: FlowGraph, source: string, target: string, label?: string): void {
    this.edgeCounter += 1;
    graph.edges.push({
      id: `se-${this.edgeCounter}-${source}-${target}`,
      source,
      target,
      label,
      kind: 'sequence',
    });
  }
}

/**
 * Build a single entry node into `graph` and connect it after `predecessors`.
 * Returns the tail node ids exiting this entry's subgraph.
 */
function buildEntry(
  graph: FlowGraph,
  ctx: BuildCtx,
  path: string,
  hierarchy: SuiteTreeNode | undefined,
  predecessors: string[],
): string[] {
  const missing = ctx.input.missingFiles?.has(path) || hierarchy?.kind === 'missing';
  if (missing) {
    const id = ctx.nextId('missing');
    graph.nodes.push({ id, kind: 'missing', label: basename(path), detail: 'missing', sourceFile: path });
    connectAll(graph, ctx, predecessors, id);
    return [id];
  }
  if (hierarchy?.kind === 'cycle') {
    const id = ctx.nextId('cycle');
    graph.nodes.push({ id, kind: 'missing', label: basename(path), detail: 'cycle', sourceFile: path });
    connectAll(graph, ctx, predecessors, id);
    return [id];
  }
  if (hierarchy?.kind === 'suite') {
    return buildSuiteEntry(graph, ctx, hierarchy, predecessors);
  }
  return buildTestEntry(graph, ctx, path, hierarchy, predecessors);
}

function buildSuiteEntry(
  graph: FlowGraph,
  ctx: BuildCtx,
  hierarchy: Extract<SuiteTreeNode, { kind: 'suite' }>,
  predecessors: string[],
): string[] {
  const id = ctx.nextId('suite');
  graph.nodes.push({
    id,
    kind: 'suite',
    label: hierarchy.title || basename(hierarchy.path),
    detail: hierarchy.path,
    sourceFile: hierarchy.path,
  });
  connectAll(graph, ctx, predecessors, id);

  let tails: string[] = [id];
  const children = hierarchy.children ?? [];
  for (const child of children) {
    if (child.kind === 'group') {
      const groupId = ctx.nextId('group');
      graph.nodes.push({
        id: groupId,
        kind: 'group',
        label: child.label,
        sourceFile: hierarchy.path,
      });
      connectAll(graph, ctx, tails, groupId);
      const groupTails: string[] = [];
      for (const sub of child.children ?? []) {
        const subPath = 'path' in sub ? sub.path : '';
        const subTails = buildEntry(graph, ctx, subPath, sub, [groupId]);
        groupTails.push(...subTails);
      }
      tails = groupTails.length > 0 ? groupTails : [groupId];
    } else {
      const subPath = 'path' in child ? child.path : '';
      tails = buildEntry(graph, ctx, subPath, child, tails);
    }
  }
  return tails;
}

function buildTestEntry(
  graph: FlowGraph,
  ctx: BuildCtx,
  path: string,
  hierarchy: SuiteTreeNode | undefined,
  predecessors: string[],
): string[] {
  const title =
      hierarchy && hierarchy.kind === 'test' && hierarchy.title ? hierarchy.title : basename(path);

  const containerId = ctx.nextId('test');
  const testData = ctx.input.testDataByPath?.[path];

  // The test container itself is the node that sits inline in the suite flow.
  graph.nodes.push({
    id: containerId,
    kind: 'test-ref',
    label: title,
    detail: path,
    sourceFile: path,
    isContainer: Boolean(testData),
  });
  connectAll(graph, ctx, predecessors, containerId);

  if (!testData) {
    return [containerId];
  }

  const inlined = inlineTestGraph(testData, containerId, path, containerId);
  if (inlined.nodes.length === 0) {
    return [containerId];
  }
  appendGraph(graph, { nodes: inlined.nodes, edges: inlined.edges });
  return [containerId];
}

function connectAll(graph: FlowGraph, ctx: BuildCtx, sources: string[], target: string): void {
  for (const s of sources) {
    ctx.connect(graph, s, target);
  }
}

function basename(p: string): string {
  const s = (p || '').replace(/\\/g, '/');
  const idx = s.lastIndexOf('/');
  return idx >= 0 ? s.slice(idx + 1) : s;
}
