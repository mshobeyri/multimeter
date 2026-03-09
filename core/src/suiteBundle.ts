import {SuiteHierarchyNode, SuiteHierarchyRootNode} from './suiteHierarchy';
import {createSuiteNodeId} from './suiteNodeId';

export type SuiteBundleNodeKind = 'group'|'suite'|'test'|'server'|'missing'|'cycle';

function resolveNodeId(node: SuiteHierarchyNode, indexPath: number[]): string {
  const existing = (node as any)?.id;
  if (typeof existing === 'string' && existing) {
    return existing;
  }
  return createSuiteNodeId(indexPath);
}

export type SuiteBundleNode =
  | {kind: 'group'; id: string; label: string; children: SuiteBundleNode[]}
  | {kind: 'suite'; id: string; path: string; title?: string; children: SuiteBundleNode[]}
  | {kind: 'test'; id: string; path: string; title?: string}
  | {kind: 'server'; id: string; path: string; title?: string}
  | {kind: 'missing'; id: string; path: string}
  | {kind: 'cycle'; id: string; path: string};

export interface SuiteBundle {
  rootSuitePath: string;
  rootTitle?: string;
  bundle: SuiteBundleNode[];
  /** Server file paths to start before suite execution and keep running throughout. */
  servers?: string[];
  target?: string;
}

export function createSuiteBundle(params: {
  rootSuitePath: string;
  hierarchy: SuiteHierarchyRootNode;
  servers?: string[];
  target?: string;
}): SuiteBundle {
  const {rootSuitePath, hierarchy, servers, target} = params;

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
        const suiteNode: SuiteBundleNode = {
          kind: 'suite',
          id,
          path: node.path,
          children: build(node.children, nextIndexPath),
        };
        if (node.title) {
          (suiteNode as any).title = node.title;
        }
        out.push(suiteNode);
        continue;
      }

      if (node.kind === 'test') {
        const id = resolveNodeId(node, nextIndexPath);
        const testNode: SuiteBundleNode = {kind: 'test', id, path: node.path};
        if (node.title) {
          (testNode as any).title = node.title;
        }
        out.push(testNode);
        continue;
      }

      if (node.kind === 'server') {
        const id = resolveNodeId(node, nextIndexPath);
        const serverNode: SuiteBundleNode = {kind: 'server', id, path: node.path};
        if (node.title) {
          (serverNode as any).title = node.title;
        }
        out.push(serverNode);
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
    rootTitle: hierarchy.title,
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
    servers: Array.isArray(servers) && servers.length > 0 ? servers : undefined,
    target: typeof target === 'string' && target ? target : undefined,
  };
}
