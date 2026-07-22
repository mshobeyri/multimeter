import { createSuiteNodeId } from 'mmt-core/suiteNodeId';
import { StepStatus } from '../../shared/types';
import type { SuiteGroup } from '../types';
import type { SuiteTreeNode } from './suiteHierarchy';

/** True when id is the partial-run target or a descendant under that target's id prefix. */
export function isUnderSuiteTarget(target: string | null | undefined, id: string | null | undefined): boolean {
  if (!target) {
    return true; // full suite run — all ids allowed
  }
  if (!id) {
    return false;
  }
  return id === target || id.startsWith(`${target}.`);
}

export function ownRunStatus(
  runStateById: Record<string, StepStatus>,
  id: string | undefined | null,
): StepStatus {
  if (!id) {
    return 'default';
  }
  return runStateById[id] || 'default';
}

/** Collect every node id under a hierarchy root (including the root). */
export function collectHierarchyNodeIds(root: SuiteTreeNode | null | undefined): string[] {
  if (!root || typeof root !== 'object') {
    return [];
  }
  const out: string[] = [];
  const stack: SuiteTreeNode[] = [root];
  while (stack.length) {
    const node = stack.pop();
    if (!node || typeof node !== 'object') {
      continue;
    }
    if (typeof node.id === 'string' && node.id) {
      out.push(node.id);
    }
    if ('children' in node && Array.isArray(node.children) && node.children.length) {
      for (let i = 0; i < node.children.length; i++) {
        stack.push(node.children[i]);
      }
    }
  }
  return out;
}

/**
 * Prime pending icons for a full suite run: top-level groups/entries plus every
 * known hierarchy descendant so the tree shows what will run before suite-item events arrive.
 */
export function buildFullSuitePendingState(
  groups: SuiteGroup[],
  hierarchyByEntryId: Record<string, SuiteTreeNode>,
): Record<string, StepStatus> {
  const next: Record<string, StepStatus> = {};
  groups.forEach((group, gi) => {
    next[createSuiteNodeId([gi])] = 'pending';
    group.entries.forEach((entry) => {
      if (!entry?.id) {
        return;
      }
      next[entry.id] = 'pending';
      for (const id of collectHierarchyNodeIds(hierarchyByEntryId[entry.id])) {
        next[id] = 'pending';
      }
    });
  });
  return next;
}

/**
 * Prime pending icons for a partial run.
 *
 * Uses id-prefix matching (same as execution allowlisting) so group targets like
 * `suite-node:0` mark every entry/descendant under that group — not only the
 * group id itself (which never appears inside per-entry hierarchy trees).
 */
export function buildTargetPendingState(
  target: string,
  groups: SuiteGroup[],
  hierarchyByEntryId: Record<string, SuiteTreeNode>,
): Record<string, StepStatus> {
  const next: Record<string, StepStatus> = {};
  if (!target) {
    return next;
  }
  next[target] = 'pending';

  groups.forEach((group, gi) => {
    const groupId = createSuiteNodeId([gi]);
    if (isUnderSuiteTarget(target, groupId)) {
      next[groupId] = 'pending';
    }
    for (const entry of group.entries) {
      if (!entry?.id) {
        continue;
      }
      if (isUnderSuiteTarget(target, entry.id)) {
        next[entry.id] = 'pending';
      }
      for (const id of collectHierarchyNodeIds(hierarchyByEntryId[entry.id])) {
        if (isUnderSuiteTarget(target, id)) {
          next[id] = 'pending';
        }
      }
    }
  });

  return next;
}
