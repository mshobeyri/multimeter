import {SuiteHierarchyNode} from './suiteHierarchy';

export type SuiteBundleNodeKind = 'group'|'suite'|'test'|'missing'|'cycle';

function createNodeId(): string {
  // Keep core platform-neutral: prefer global crypto when available.
  const anyCrypto = (globalThis as any)?.crypto;
  if (anyCrypto && typeof anyCrypto.randomUUID === 'function') {
    return anyCrypto.randomUUID();
  }
  // Fallback: UUID v4-ish generator without node/browser deps.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export type SuiteBundleNode =
  | {kind: 'group'; id: string; label: string; children: SuiteBundleNode[]}
  | {kind: 'suite'; id: string; path: string; children: SuiteBundleNode[]}
  | {kind: 'test'; id: string; path: string}
  | {kind: 'missing'; id: string; path: string}
  | {kind: 'cycle'; id: string; path: string};

export interface SuiteBundle {
  rootSuitePath: string;
  bundle: SuiteBundleNode[];
  target?: string;
}

export function createSuiteBundle(params: {
  rootSuitePath: string;
  hierarchy: SuiteHierarchyNode[];
  target?: string;
}): SuiteBundle {
  const {rootSuitePath, hierarchy, target} = params;

  const build = (nodes: readonly SuiteHierarchyNode[], indexPath: number[]): SuiteBundleNode[] => {
    const out: SuiteBundleNode[] = [];

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const nextIndexPath = [...indexPath, i];

      if (node.kind === 'group') {
        const id = createNodeId();
        out.push({
          kind: 'group',
          id,
          label: node.label,
          children: build(node.children, nextIndexPath),
        });
        continue;
      }

      if (node.kind === 'suite') {
        const id = createNodeId();
        out.push({
          kind: 'suite',
          id,
          path: node.path,
          children: build(node.children, nextIndexPath),
        });
        continue;
      }

      if (node.kind === 'test') {
        const id = createNodeId();
        out.push({kind: 'test', id, path: node.path});
        continue;
      }

      if (node.kind === 'missing') {
        const id = createNodeId();
        out.push({kind: 'missing', id, path: node.path});
        continue;
      }

      if (node.kind === 'cycle') {
        const id = createNodeId();
        out.push({kind: 'cycle', id, path: node.path});
        continue;
      }
    }

    return out;
  };

  return {
    rootSuitePath,
    bundle: build(hierarchy, []),
    target: typeof target === 'string' && target ? target : undefined,
  };
}
