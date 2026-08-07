import type { SuiteTreeNode } from './suiteHierarchy';

/** Stable structural fingerprint of a suite hierarchy tree (ids, kinds, paths, labels). */
export function fingerprintSuiteTreeNode(node: SuiteTreeNode | null | undefined): string {
  if (!node || typeof node !== 'object') {
    return '';
  }
  const parts: string[] = [node.kind, node.id];
  if (node.kind === 'group') {
    parts.push(node.label || '');
  } else if (node.kind === 'suite' || node.kind === 'test') {
    parts.push(node.path || '');
    parts.push(('title' in node && node.title) ? node.title : '');
  } else if (node.kind === 'missing' || node.kind === 'cycle') {
    parts.push(node.path || '');
  }
  if ('children' in node && Array.isArray(node.children) && node.children.length) {
    parts.push('[', ...node.children.map(fingerprintSuiteTreeNode), ']');
  }
  return parts.join('|');
}

/** Fingerprint a map of entry-id → hierarchy roots. */
export function fingerprintHierarchyByEntryId(
  hierarchyByEntryId: Record<string, SuiteTreeNode> | null | undefined,
): string {
  if (!hierarchyByEntryId) {
    return '';
  }
  const keys = Object.keys(hierarchyByEntryId).sort();
  return keys.map((key) => `${key}=${fingerprintSuiteTreeNode(hierarchyByEntryId[key])}`).join('\n');
}

/** Find a node by id anywhere under the hierarchy map. */
export function findHierarchyNodeById(
  hierarchyByEntryId: Record<string, SuiteTreeNode>,
  id: string,
): SuiteTreeNode | null {
  if (!id) {
    return null;
  }
  const stack: SuiteTreeNode[] = Object.values(hierarchyByEntryId);
  while (stack.length) {
    const node = stack.pop();
    if (!node || typeof node !== 'object') {
      continue;
    }
    if (node.id === id) {
      return node;
    }
    if ('children' in node && Array.isArray(node.children)) {
      for (const child of node.children) {
        stack.push(child);
      }
    }
  }
  return null;
}

function sameLogicalNode(a: SuiteTreeNode, b: SuiteTreeNode): boolean {
  if (a.kind !== b.kind) {
    return false;
  }
  if (a.kind === 'group' && b.kind === 'group') {
    return a.label === b.label;
  }
  if ('path' in a && 'path' in b) {
    const titleA = ('title' in a && a.title) ? a.title : '';
    const titleB = ('title' in b && b.title) ? b.title : '';
    return a.path === b.path && titleA === titleB;
  }
  return false;
}

/**
 * When positional ids shift after an edit, remap a stale target id to the new
 * id of the same path (or same path+title) in the fresh hierarchy.
 *
 * Important: an id may still exist but now point at a different file after an
 * insert above it — compare path/title, not id alone.
 */
export function remapSuiteTargetId(
  staleTarget: string,
  previous: Record<string, SuiteTreeNode>,
  next: Record<string, SuiteTreeNode>,
): string {
  if (!staleTarget) {
    return staleTarget;
  }
  const oldNode = findHierarchyNodeById(previous, staleTarget);
  const newAtSameId = findHierarchyNodeById(next, staleTarget);
  if (oldNode && newAtSameId && sameLogicalNode(oldNode, newAtSameId)) {
    return staleTarget;
  }
  if (!oldNode) {
    return staleTarget;
  }
  if (!('path' in oldNode) || !oldNode.path) {
    return staleTarget;
  }
  const oldPath = oldNode.path;
  const oldTitle = ('title' in oldNode && oldNode.title) ? oldNode.title : undefined;
  const stack: SuiteTreeNode[] = Object.values(next);
  let pathOnlyMatch: string | null = null;
  while (stack.length) {
    const node = stack.pop();
    if (!node || typeof node !== 'object') {
      continue;
    }
    if ((node.kind === 'test' || node.kind === 'suite') && node.path === oldPath) {
      if (oldTitle && node.title === oldTitle) {
        return node.id;
      }
      if (!pathOnlyMatch) {
        pathOnlyMatch = node.id;
      }
    }
    if ('children' in node && Array.isArray(node.children)) {
      for (const child of node.children) {
        stack.push(child);
      }
    }
  }
  return pathOnlyMatch || staleTarget;
}
