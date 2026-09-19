import type {SuiteHierarchyNode} from 'mmt-core/SuiteData';

export type SuiteTreeNode = SuiteHierarchyNode;

/** Items shown under a suite: `servers:` first, then `items:`. */
export function suiteTreeChildren(node: SuiteTreeNode | null | undefined): SuiteTreeNode[] {
  if (!node || typeof node !== 'object') {
    return [];
  }
  if (node.kind === 'suite') {
    const servers = Array.isArray(node.serverItems) ? node.serverItems : [];
    const children = Array.isArray(node.children) ? node.children : [];
    return servers.length ? [...servers, ...children] : children;
  }
  if (node.kind === 'group') {
    return Array.isArray(node.children) ? node.children : [];
  }
  return [];
}
