import { TestData } from 'mmt-core/TestData';
import { buildTestGraph } from './buildTestGraph';
import { FlowEdge, FlowGraph, FlowNode } from './types';

export interface InlinedTestGraph {
  /** Nodes of the test's flow, excluding start/end terminals. */
  nodes: FlowNode[];
  /** Edges, excluding any incident to start/end. */
  edges: FlowEdge[];
  /** Node ids that originally followed the test's start node. */
  entries: string[];
  /** Node ids that originally preceded the test's end node. */
  exits: string[];
}

/**
 * Build a test's flow graph and strip the start/end terminal pills so the
 * resulting subgraph can be embedded inside a suite flowchart. All node and
 * edge ids are prefixed to guarantee uniqueness within the host graph.
 * If `parentId` is provided, every emitted node is tagged with that parent
 * so React Flow lays it out inside the container.
 */
export function inlineTestGraph(
  test: TestData,
  idPrefix: string,
  filePath?: string,
  parentId?: string,
  callTitleByAlias?: Record<string, string | undefined>,
): InlinedTestGraph {
  const raw = buildTestGraph({ test, filePath, callTitleByAlias });

  const startId = 'n-start';
  const endId = 'n-end';

  const entries: string[] = [];
  const exits: string[] = [];
  for (const e of raw.edges) {
    if (e.source === startId) {
      entries.push(e.target);
    }
    if (e.target === endId) {
      exits.push(e.source);
    }
  }

  const prefix = (id: string) => `${idPrefix}:${id}`;

  const nodes: FlowNode[] = raw.nodes
    .filter((n) => n.id !== startId && n.id !== endId)
    .map((n) => ({ ...n, id: prefix(n.id), parentId: parentId ?? n.parentId }));

  const edges: FlowEdge[] = raw.edges
    .filter((e) => e.source !== startId && e.target !== endId)
    .map((e) => ({
      ...e,
      id: `${idPrefix}:${e.id}`,
      source: prefix(e.source),
      target: prefix(e.target),
    }));

  return {
    nodes,
    edges,
    entries: entries.map(prefix),
    exits: exits.map(prefix),
  };
}

/** Append a subgraph into an accumulating graph. */
export function appendGraph(into: FlowGraph, fragment: { nodes: FlowNode[]; edges: FlowEdge[] }): void {
  into.nodes.push(...fragment.nodes);
  into.edges.push(...fragment.edges);
}
