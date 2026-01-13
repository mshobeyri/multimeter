import {SuiteHierarchyNode, SuiteHierarchyRootNode} from './suiteHierarchy';
import {createSuiteNodeId} from './suiteNodeId';

export type SuiteBundleNodeKind = 'group'|'suite'|'test'|'missing'|'cycle';

function resolveNodeId(node: SuiteHierarchyNode, indexPath: number[]): string {
  const existing = (node as any)?.id;
  if (typeof existing === 'string' && existing) {
    return existing;
  }
  return createSuiteNodeId(indexPath);
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
  hierarchy: SuiteHierarchyRootNode;
  target?: string;
}): SuiteBundle {
  const {rootSuitePath, hierarchy, target} = params;

  const build = (nodes: readonly SuiteHierarchyNode[], indexPath: number[]): SuiteBundleNode[] => {
    const out: SuiteBundleNode[] = [];

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const nextIndexPath = [...indexPath, i];

      if (node.kind === 'group') {
        const id = resolveNodeId(node, nextIndexPath);
        out.push({
          kind: 'group',
          id,
          label: node.label,
          children: build(node.children, nextIndexPath),
        });
        continue;
      }

      if (node.kind === 'suite') {
        const id = resolveNodeId(node, nextIndexPath);
        out.push({
          kind: 'suite',
          id,
          path: node.path,
          children: build(node.children, nextIndexPath),
        });
        continue;
      }

      if (node.kind === 'test') {
        const id = resolveNodeId(node, nextIndexPath);
        out.push({kind: 'test', id, path: node.path});
        continue;
      }

      if (node.kind === 'missing') {
        const id = resolveNodeId(node, nextIndexPath);
        out.push({kind: 'missing', id, path: node.path});
        continue;
      }

      if (node.kind === 'cycle') {
        const id = resolveNodeId(node, nextIndexPath);
        out.push({kind: 'cycle', id, path: node.path});
        continue;
      }
    }

    return out;
  };

  return {
    rootSuitePath,
    bundle: (() => {
      const built = build(hierarchy.children, []);
      const hasAnyGroup = built.some((n) => n.kind === 'group');
      if (hasAnyGroup || built.length === 0) {
        return built;
      }
      // Match suiteHierarchy semantics: if there is no explicit group,
      // treat all root entries as being in a single group.
      return [{kind: 'group', id: createSuiteNodeId([0]), label: 'Group 1', children: built}];
    })(),
    target: typeof target === 'string' && target ? target : undefined,
  };
}
