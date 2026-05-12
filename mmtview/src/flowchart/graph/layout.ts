import { FlowGraph } from './types';

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
}

const DEFAULTS = { rankSpacing: 260, nodeSpacing: 130 };

/**
 * Simple left-to-right rank-based layout. Ranks are computed by the longest
 * incoming path length so branches stay vertically separated. Nodes within
 * the same rank are stacked and vertically centered.
 */
export function applyLayout(graph: FlowGraph, options: LayoutOptions = {}): Record<string, LaidOutNode> {
  const rankSpacing = options.rankSpacing ?? DEFAULTS.rankSpacing;
  const nodeSpacing = options.nodeSpacing ?? DEFAULTS.nodeSpacing;

  const inEdges = new Map<string, string[]>();
  const outEdges = new Map<string, string[]>();
  for (const e of graph.edges) {
    if (!inEdges.has(e.target)) {
      inEdges.set(e.target, []);
    }
    inEdges.get(e.target)!.push(e.source);
    if (!outEdges.has(e.source)) {
      outEdges.set(e.source, []);
    }
    outEdges.get(e.source)!.push(e.target);
  }

  // Compute rank as longest path from any source (node with no incoming edges).
  const rank = new Map<string, number>();
  const visiting = new Set<string>();
  const visit = (id: string): number => {
    if (rank.has(id)) {
      return rank.get(id)!;
    }
    if (visiting.has(id)) {
      // Cycle guard.
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
  for (const n of graph.nodes) {
    visit(n.id);
  }

  // Bucket nodes by rank in declaration order.
  const buckets = new Map<number, string[]>();
  for (const n of graph.nodes) {
    const r = rank.get(n.id) ?? 0;
    if (!buckets.has(r)) {
      buckets.set(r, []);
    }
    buckets.get(r)!.push(n.id);
  }

  // Vertically center each bucket around y=0.
  const positions: Record<string, LaidOutNode> = {};
  buckets.forEach((ids, r) => {
    const count = ids.length;
    const totalHeight = (count - 1) * nodeSpacing;
    const top = -totalHeight / 2;
    ids.forEach((id, idx) => {
      positions[id] = { id, x: r * rankSpacing, y: top + idx * nodeSpacing };
    });
  });
  return positions;
}
