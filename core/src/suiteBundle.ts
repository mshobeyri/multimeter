import {SuiteHierarchyNode} from './suiteHierarchy';

export type SuiteBundleNodeKind = 'group'|'suite'|'test'|'missing'|'cycle';

export type SuiteBundleNode =
  | {kind: 'group'; nodeId: string; label: string; children: SuiteBundleNode[]}
  | {kind: 'suite'; nodeId: string; path: string; children: SuiteBundleNode[]}
  | {kind: 'test'; nodeId: string; path: string}
  | {kind: 'missing'; nodeId: string; path: string}
  | {kind: 'cycle'; nodeId: string; path: string};

export interface SuiteBundle {
  rootSuitePath: string;
  nodes: SuiteBundleNode[];
  runnableLeafIds: string[];
}

function isRunnableLeaf(node: SuiteBundleNode): boolean {
  return node.kind === 'test' || node.kind === 'suite';
}

function collectRunnableLeafIds(nodes: readonly SuiteBundleNode[]): string[] {
  const out: string[] = [];
  const walk = (n: SuiteBundleNode) => {
    if (isRunnableLeaf(n)) {
      out.push(n.nodeId);
      return;
    }
    if (n.kind === 'group' || n.kind === 'suite') {
      for (const c of n.children) {
        walk(c);
      }
    }
  };
  for (const n of nodes) {
    walk(n);
  }
  return out;
}

export function buildSuiteBundleFromHierarchy(params: {
  rootSuitePath: string;
  hierarchy: SuiteHierarchyNode[];
}): SuiteBundle {
  const {rootSuitePath, hierarchy} = params;

  const build = (
      nodes: readonly SuiteHierarchyNode[], prefix: string): SuiteBundleNode[] => {
    const out: SuiteBundleNode[] = [];
    let itemIndex = 0;

    for (const node of nodes) {
      if (node.kind === 'group') {
        const groupIndex = out.filter((n) => n.kind === 'group').length;
        const nodeId = `${prefix}g:${groupIndex}`;
        out.push({
          kind: 'group',
          nodeId,
          label: node.label,
          children: build(node.children, `${nodeId}/`),
        });
        continue;
      }

      const nodeId = `${prefix}i:${itemIndex}`;
      itemIndex++;

      if (node.kind === 'suite') {
        out.push({
          kind: 'suite',
          nodeId,
          path: node.path,
          children: build(node.children, `${nodeId}/`),
        });
        continue;
      }

      if (node.kind === 'test') {
        out.push({kind: 'test', nodeId, path: node.path});
        continue;
      }

      if (node.kind === 'missing') {
        out.push({kind: 'missing', nodeId, path: node.path});
        continue;
      }

      if (node.kind === 'cycle') {
        out.push({kind: 'cycle', nodeId, path: node.path});
        continue;
      }
    }

    return out;
  };

  const nodes = build(hierarchy, '');
  return {
    rootSuitePath,
    nodes,
    runnableLeafIds: collectRunnableLeafIds(nodes),
  };
}
