import { FlowEdge, FlowGraph, FlowNode } from './types';

export interface LaidOutNode {
  id: string;
  x: number;
  y: number;
}

export interface LayoutOptions {
  /** Horizontal spacing between ranks. */
  rankSpacing?: number;
  /** Vertical spacing between siblings on the same rank. */
  nodeSpacing?: number;
  /** Horizontal spacing inside container nodes. */
  innerRankSpacing?: number;
  /** Vertical spacing inside container nodes. */
  innerNodeSpacing?: number;
}

const DEFAULTS = { rankSpacing: 170, nodeSpacing: 82, innerRankSpacing: 150, innerNodeSpacing: 70 };

/** Approximate render footprint for non-container nodes. */
const DEFAULT_NODE_WIDTH = 200;
const DEFAULT_NODE_HEIGHT = 90;

/** Padding applied inside container nodes. */
const CONTAINER_PADDING_X = 24;
const CONTAINER_PADDING_TOP = 64; // room for the header
const CONTAINER_PADDING_BOTTOM = 24;

/**
 * Compute positions for every node in the graph. Container nodes
 * (`isContainer: true`) get their `width`/`height` mutated in place so they
 * are large enough to wrap their children. Children with a `parentId` are
 * returned with coordinates relative to their parent (as React Flow expects).
 */
export function applyLayout(graph: FlowGraph, options: LayoutOptions = {}): Record<string, LaidOutNode> {
  const rankSpacing = options.rankSpacing ?? DEFAULTS.rankSpacing;
  const nodeSpacing = options.nodeSpacing ?? DEFAULTS.nodeSpacing;
  const innerRankSpacing = options.innerRankSpacing ?? DEFAULTS.innerRankSpacing;
  const innerNodeSpacing = options.innerNodeSpacing ?? DEFAULTS.innerNodeSpacing;

  const childrenByParent = new Map<string | undefined, FlowNode[]>();
  for (const n of graph.nodes) {
    const key = n.parentId;
    if (!childrenByParent.has(key)) {
      childrenByParent.set(key, []);
    }
    childrenByParent.get(key)!.push(n);
  }

  const positions: Record<string, LaidOutNode> = {};

  // 1) Lay out each container's children first (relative coordinates) and
  // size the container based on the bounding box of its children.
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const containers = graph.nodes
    .filter((node) => node.isContainer)
    .sort((a, b) => parentDepth(b, nodeById) - parentDepth(a, nodeById));

  for (const node of containers) {
    if (!node.isContainer) {
      continue;
    }
    const children = childrenByParent.get(node.id) ?? [];
    if (children.length === 0) {
      node.width = node.width ?? DEFAULT_NODE_WIDTH;
      node.height = node.height ?? DEFAULT_NODE_HEIGHT;
      continue;
    }
    const innerEdges = graph.edges.filter((e) => {
      const sParent = nodeById.get(e.source)?.parentId;
      const tParent = nodeById.get(e.target)?.parentId;
      return sParent === node.id && tParent === node.id;
    });
    const childPositions = layoutFlat(children, innerEdges, { rankSpacing: innerRankSpacing, nodeSpacing: innerNodeSpacing });
    const bbox = boundingBox(children, childPositions);
    const dx = CONTAINER_PADDING_X - bbox.minX;
    const dy = CONTAINER_PADDING_TOP - bbox.minY;
    for (const child of children) {
      const p = childPositions[child.id];
      positions[child.id] = { id: child.id, x: p.x + dx, y: p.y + dy };
    }
    node.width = Math.max(DEFAULT_NODE_WIDTH, bbox.maxX - bbox.minX + CONTAINER_PADDING_X * 2);
    node.height = Math.max(
      DEFAULT_NODE_HEIGHT,
      bbox.maxY - bbox.minY + CONTAINER_PADDING_TOP + CONTAINER_PADDING_BOTTOM,
    );
  }

  // 2) Lay out top-level nodes.
  const topNodes = childrenByParent.get(undefined) ?? [];
  const topEdges = normalizeTopEdges(graph);
  const topPositions = layoutFlat(topNodes, topEdges, { rankSpacing, nodeSpacing });
  for (const n of topNodes) {
    const p = topPositions[n.id];
    positions[n.id] = { id: n.id, x: p.x, y: p.y };
  }

  return positions;
}

function parentDepth(node: FlowNode, nodeById: Map<string, FlowNode>): number {
  let depth = 0;
  let current = node.parentId ? nodeById.get(node.parentId) : undefined;
  while (current) {
    depth += 1;
    current = current.parentId ? nodeById.get(current.parentId) : undefined;
  }
  return depth;
}

function normalizeTopEdges(graph: FlowGraph): FlowEdge[] {
  const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));
  const topOwner = (id: string): string | undefined => {
    const node = nodeById.get(id);
    if (!node) {
      return undefined;
    }
    return node.parentId ?? node.id;
  };
  const seen = new Set<string>();
  const edges: FlowEdge[] = [];
  for (const e of graph.edges) {
    const source = topOwner(e.source);
    const target = topOwner(e.target);
    if (!source || !target || source === target) {
      continue;
    }
    const key = `${source}->${target}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    edges.push({ ...e, source, target });
  }
  return edges;
}

function boundingBox(
  nodes: FlowNode[],
  positions: Record<string, LaidOutNode>,
): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const n of nodes) {
    const p = positions[n.id];
    if (!p) {
      continue;
    }
    const w = n.width ?? DEFAULT_NODE_WIDTH;
    const h = n.height ?? DEFAULT_NODE_HEIGHT;
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x + w);
    maxY = Math.max(maxY, p.y + h);
  }
  if (!isFinite(minX)) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  }
  return { minX, minY, maxX, maxY };
}

/**
 * Simple left-to-right rank-based layout for a flat set of nodes/edges.
 * Returns positions where (x, y) is the top-left of the node's box.
 */
function layoutFlat(
  nodes: FlowNode[],
  edges: FlowEdge[],
  opts: { rankSpacing: number; nodeSpacing: number },
): Record<string, LaidOutNode> {
  const ids = new Set(nodes.map((n) => n.id));
  const inEdges = new Map<string, string[]>();
  for (const e of edges) {
    if (e.kind === 'loop-back') {
      continue;
    }
    if (!ids.has(e.source) || !ids.has(e.target)) {
      continue;
    }
    if (!inEdges.has(e.target)) {
      inEdges.set(e.target, []);
    }
    inEdges.get(e.target)!.push(e.source);
  }

  const rank = new Map<string, number>();
  const visiting = new Set<string>();
  const visit = (id: string): number => {
    if (rank.has(id)) {
      return rank.get(id)!;
    }
    if (visiting.has(id)) {
      return 0;
    }
    visiting.add(id);
    const ins = inEdges.get(id) ?? [];
    let r = 0;
    for (const src of ins) {
      r = Math.max(r, visit(src) + 1);
    }
    visiting.delete(id);
    rank.set(id, r);
    return r;
  };
  for (const n of nodes) {
    visit(n.id);
  }

  const buckets = new Map<number, FlowNode[]>();
  for (const n of nodes) {
    const r = rank.get(n.id) ?? 0;
    if (!buckets.has(r)) {
      buckets.set(r, []);
    }
    buckets.get(r)!.push(n);
  }
  const sortedRanks = Array.from(buckets.keys()).sort((a, b) => a - b);

  // Column x: cursor advances by max column width + spacing.
  const colX: Record<number, number> = {};
  let cursorX = 0;
  for (const r of sortedRanks) {
    colX[r] = cursorX;
    const colW = Math.max(
      DEFAULT_NODE_WIDTH,
      ...buckets.get(r)!.map((n) => n.width ?? DEFAULT_NODE_WIDTH),
    );
    cursorX += colW + opts.rankSpacing;
  }

  const positions: Record<string, LaidOutNode> = {};
  for (const r of sortedRanks) {
    const list = buckets.get(r)!;
    const heights = list.map((n) => n.height ?? DEFAULT_NODE_HEIGHT);
    const totalHeight = heights.reduce((a, b) => a + b, 0) + opts.nodeSpacing * Math.max(0, list.length - 1);
    let y = -totalHeight / 2;
    list.forEach((n, idx) => {
      positions[n.id] = { id: n.id, x: colX[r], y };
      y += heights[idx] + opts.nodeSpacing;
    });
  }
  return positions;
}
