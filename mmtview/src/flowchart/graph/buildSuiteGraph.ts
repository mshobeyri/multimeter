import { SuiteGroup } from '../../suite/types';
import { SuiteTreeNode } from '../../suite/test/suiteHierarchy';
import { FlowEdge, FlowGraph, FlowNode } from './types';

export interface BuildSuiteGraphInput {
  rootTitle?: string;
  rootPath?: string;
  groups: SuiteGroup[];
  /** Resolved hierarchy keyed by entry path. Used only to detect node kind/title. */
  hierarchyByEntryPath?: Record<string, SuiteTreeNode | undefined>;
  /** Set of missing file paths. */
  missingFiles?: Set<string>;
}

/**
 * Top-level suite graph.
 *
 * Layout semantics (matches runtime):
 *   START → [group_1 entries in parallel] → [group_2 entries in parallel] → … → END
 *
 * Sub-suites are rendered as a single `suite` node (no inline expansion) —
 * clicking opens the sub-suite file.
 */
export function buildSuiteGraph(input: BuildSuiteGraphInput): FlowGraph {
  const nodes: FlowNode[] = [];
  const edges: FlowEdge[] = [];
  let counter = 0;
  let edgeCounter = 0;
  const nextId = (prefix: string) => `sn-${prefix}-${++counter}`;
  const connect = (source: string, target: string) => {
    edgeCounter += 1;
    edges.push({
      id: `se-${edgeCounter}-${source}-${target}`,
      source,
      target,
      kind: 'sequence',
    });
  };

  const startId = 'sn-start';
  nodes.push({
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
    const groupNodeId = nextId('group');
    nodes.push({
      id: groupNodeId,
      kind: 'group',
      label: group.label,
      sourceFile: input.rootPath,
    });
    for (const t of previousTails) {
      connect(t, groupNodeId);
    }

    const entryTails: string[] = [];
    for (const entry of group.entries) {
      const hierarchy = input.hierarchyByEntryPath?.[entry.path];
      const node = renderEntryNode(entry.path, hierarchy, input.missingFiles, nextId);
      nodes.push(node);
      connect(groupNodeId, node.id);
      entryTails.push(node.id);
    }

    previousTails = entryTails;
  }

  const endId = 'sn-end';
  nodes.push({
    id: endId,
    kind: 'end',
    label: 'END POINT',
    sourceFile: input.rootPath,
  });
  for (const t of previousTails) {
    connect(t, endId);
  }

  return { nodes, edges };
}

function renderEntryNode(
  path: string,
  hierarchy: SuiteTreeNode | undefined,
  missing: Set<string> | undefined,
  nextId: (prefix: string) => string,
): FlowNode {
  if (missing?.has(path) || hierarchy?.kind === 'missing') {
    return {
      id: nextId('missing'),
      kind: 'missing',
      label: basename(path),
      detail: 'missing',
      sourceFile: path,
    };
  }
  if (hierarchy?.kind === 'cycle') {
    return {
      id: nextId('cycle'),
      kind: 'missing',
      label: basename(path),
      detail: 'cycle',
      sourceFile: path,
    };
  }
  if (hierarchy?.kind === 'suite') {
    return {
      id: nextId('suite'),
      kind: 'suite',
      label: hierarchy.title || basename(path),
      detail: path,
      sourceFile: path,
    };
  }
  const title =
      hierarchy && hierarchy.kind === 'test' && hierarchy.title ? hierarchy.title : undefined;
  return {
    id: nextId('test'),
    kind: 'test-ref',
    label: title || basename(path),
    detail: path,
    sourceFile: path,
  };
}

function basename(p: string): string {
  const s = (p || '').replace(/\\/g, '/');
  const idx = s.lastIndexOf('/');
  return idx >= 0 ? s.slice(idx + 1) : s;
}
