export type SuiteTreeNode =
  | { kind: 'group'; id: string; label: string; children: SuiteTreeNode[] }
  | { kind: 'suite'; id: string; path: string; title?: string; children: SuiteTreeNode[]; servers?: string[]; serverItems?: Array<Extract<SuiteTreeNode, { kind: 'server' | 'missing' }>> }
  | { kind: 'test'; id: string; path: string; title?: string }
  | { kind: 'server'; id: string; path: string; title?: string }
  | { kind: 'missing'; id: string; path: string }
  | { kind: 'cycle'; id: string; path: string };

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
