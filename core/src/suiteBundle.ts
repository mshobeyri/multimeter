import {SuiteHierarchyNode} from './suiteHierarchy';

export type SuiteBundleNodeKind = 'group'|'suite'|'test'|'missing'|'cycle';

const randomLeafId = (): string => {
  try {
    const anyCrypto = (globalThis as any)?.crypto;
    if (anyCrypto && typeof anyCrypto.randomUUID === 'function') {
      return anyCrypto.randomUUID();
    }
  } catch {
    // ignore
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export type SuiteBundleNode =
  | {kind: 'group'; leafId: string; label: string; children: SuiteBundleNode[]}
  | {kind: 'suite'; leafId: string; path: string; children: SuiteBundleNode[]}
  | {kind: 'test'; leafId: string; path: string}
  | {kind: 'missing'; leafId: string; path: string}
  | {kind: 'cycle'; leafId: string; path: string};

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
      out.push(n.leafId);
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

  const build = (nodes: readonly SuiteHierarchyNode[]): SuiteBundleNode[] => {
    const out: SuiteBundleNode[] = [];

    for (const node of nodes) {
      if (node.kind === 'group') {
        const leafId = randomLeafId();
        out.push({
          kind: 'group',
          leafId,
          label: node.label,
          children: build(node.children),
        });
        continue;
      }

      const leafId = randomLeafId();

      if (node.kind === 'suite') {
        out.push({
          kind: 'suite',
          leafId,
          path: node.path,
          children: build(node.children),
        });
        continue;
      }

      if (node.kind === 'test') {
        out.push({kind: 'test', leafId, path: node.path});
        continue;
      }

      if (node.kind === 'missing') {
        out.push({kind: 'missing', leafId, path: node.path});
        continue;
      }

      if (node.kind === 'cycle') {
        out.push({kind: 'cycle', leafId, path: node.path});
        continue;
      }
    }

    return out;
  };

  const nodes = build(hierarchy);
  return {
    rootSuitePath,
    nodes,
    runnableLeafIds: collectRunnableLeafIds(nodes),
  };
}
