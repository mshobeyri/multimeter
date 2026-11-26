import { createSuiteNodeId } from 'mmt-core/suite/suiteNodeId';
import { aggregateStepStatuses } from 'mmt-core/suite/suiteItemStatus';
import { StepStatus } from '../../shared/types';
import type { SuiteGroup } from '../types';
import type { SuiteTreeNode } from './suiteHierarchy';
import { suiteTreeChildren } from './suiteHierarchy';

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

/**
 * Settle own-node states when a run is over (ended or stopped), limited to the
 * partial-run target subtree (or everything for a full run):
 * - `running` was never finished → `cancelled` when stopped, else `invalid`
 *   (no finish event: not a check failure, not a user stop);
 * - `pending` never started (e.g. a mock server failed first) → `cancelled`
 *   when stopped, else cleared back to default instead of a clock forever.
 * Returns `prev` itself when nothing changed.
 */
export function settleRunStateAtEnd(
  prev: Record<string, StepStatus>,
  target: string | null | undefined,
  cancelled: boolean,
): Record<string, StepStatus> {
  let next: Record<string, StepStatus> | null = null;
  for (const [id, status] of Object.entries(prev)) {
    if (status !== 'running' && status !== 'pending') {
      continue;
    }
    if (!isUnderSuiteTarget(target, id)) {
      continue;
    }
    if (!next) {
      next = { ...prev };
    }
    if (cancelled) {
      next[id] = 'cancelled';
    } else if (status === 'running') {
      next[id] = 'invalid';
    } else {
      delete next[id];
    }
  }
  return next || prev;
}

/**
 * Settle the target subtree, then recompute its ancestors. Shared by run end,
 * host stop, and a stop that arrives before the run was sent.
 */
export function finishRunState(
  prev: Record<string, StepStatus>,
  target: string | null | undefined,
  cancelled: boolean,
  groups: SuiteGroup[],
  hierarchyByEntryId: Record<string, SuiteTreeNode>,
): Record<string, StepStatus> {
  const settled = settleRunStateAtEnd(prev, target, cancelled);
  const ancestorPatches = rollupAncestorRunStatus(settled, target, groups, hierarchyByEntryId);
  if (Object.keys(ancestorPatches).length === 0) {
    return settled;
  }
  return { ...settled, ...ancestorPatches };
}

/**
 * Roll child run states into one parent state.
 * Shared rule set: `aggregateStepStatuses` in mmt-core (see suiteItemStatus).
 */
export function rollupRunStatus(childStatuses: readonly StepStatus[]): StepStatus {
  return aggregateStepStatuses(childStatuses) as StepStatus;
}

/** Parent id → child ids (servers excluded: they carry no run status). */
function buildRunTreeChildren(
  groups: SuiteGroup[],
  hierarchyByEntryId: Record<string, SuiteTreeNode>,
): { childrenOf: Map<string, string[]>; parentOf: Map<string, string> } {
  const childrenOf = new Map<string, string[]>();
  const parentOf = new Map<string, string>();

  const link = (parentId: string, childId: string) => {
    parentOf.set(childId, parentId);
    const list = childrenOf.get(parentId);
    if (list) {
      list.push(childId);
    } else {
      childrenOf.set(parentId, [childId]);
    }
  };

  const walk = (node: SuiteTreeNode) => {
    for (const child of suiteTreeChildren(node)) {
      if (!child || typeof child !== 'object' || child.kind === 'server' || !child.id) {
        continue;
      }
      link(node.id, child.id);
      walk(child);
    }
  };

  groups.forEach((group, gi) => {
    const groupId = createSuiteNodeId([gi]);
    for (const entry of group.entries) {
      const hierarchy = entry?.id ? hierarchyByEntryId[entry.id] : undefined;
      if (!entry?.id || hierarchy?.kind === 'server') {
        continue;
      }
      link(groupId, entry.id);
      if (hierarchy) {
        walk(hierarchy);
      }
    }
  });

  return { childrenOf, parentOf };
}

/**
 * After a partial run of `target`, recompute every ancestor's own status from
 * its children (bottom-up). The target and its descendants are left to core.
 * Returns only the entries that changed, ready for `patchRunState`.
 */
export function rollupAncestorRunStatus(
  runStateById: Record<string, StepStatus>,
  target: string | null | undefined,
  groups: SuiteGroup[],
  hierarchyByEntryId: Record<string, SuiteTreeNode>,
): Record<string, StepStatus> {
  if (!target) {
    return {};
  }
  const { childrenOf, parentOf } = buildRunTreeChildren(groups, hierarchyByEntryId);
  const working: Record<string, StepStatus> = { ...runStateById };
  const patches: Record<string, StepStatus> = {};

  const seen = new Set<string>();
  let ancestor = parentOf.get(target);
  while (ancestor && !seen.has(ancestor)) {
    seen.add(ancestor);
    const kids = childrenOf.get(ancestor) || [];
    const next = rollupRunStatus(kids.map((id) => working[id] || 'default'));
    const current = working[ancestor] || 'default';
    if (next !== current) {
      working[ancestor] = next;
      patches[ancestor] = next;
    }
    ancestor = parentOf.get(ancestor);
  }
  return patches;
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
    if (node.kind === 'server') {
      continue;
    }
    if (typeof node.id === 'string' && node.id) {
      out.push(node.id);
    }
    for (const child of suiteTreeChildren(node)) {
      stack.push(child);
    }
  }
  return out;
}

function omitServerRunStatus(
  next: Record<string, StepStatus>,
  groups: SuiteGroup[],
  hierarchyByEntryId: Record<string, SuiteTreeNode>,
): void {
  const stack: SuiteTreeNode[] = [];
  for (const group of groups) {
    for (const entry of group.entries) {
      if (!entry?.id) {
        continue;
      }
      const hierarchy = hierarchyByEntryId[entry.id];
      if (!hierarchy) {
        continue;
      }
      stack.push(hierarchy);
    }
  }
  while (stack.length) {
    const node = stack.pop();
    if (!node || typeof node !== 'object') {
      continue;
    }
    if (node.kind === 'server' && typeof node.id === 'string' && node.id) {
      delete next[node.id];
    }
    for (const child of suiteTreeChildren(node)) {
      stack.push(child);
    }
  }
}

/**
 * Prime pending icons for a full suite run: top-level groups/entries plus every
 * known hierarchy descendant so the tree shows what will run before suite-item events arrive.
 */
/** Add pending icons for newly discovered nodes without clobbering active run states. */
export function mergePendingRunState(
  prev: Record<string, StepStatus>,
  pending: Record<string, StepStatus>,
): Record<string, StepStatus> {
  const next = { ...prev };
  for (const [id, status] of Object.entries(pending)) {
    const current = next[id];
    if (current === undefined || current === 'default' || current === 'pending') {
      next[id] = status;
    }
  }
  return next;
}

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
      const hierarchy = hierarchyByEntryId[entry.id];
      if (hierarchy?.kind === 'server') {
        return;
      }
      next[entry.id] = 'pending';
      for (const id of collectHierarchyNodeIds(hierarchy)) {
        next[id] = 'pending';
      }
    });
  });
  omitServerRunStatus(next, groups, hierarchyByEntryId);
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
      const hierarchy = hierarchyByEntryId[entry.id];
      if (hierarchy?.kind === 'server') {
        continue;
      }
      if (isUnderSuiteTarget(target, entry.id)) {
        next[entry.id] = 'pending';
      }
      for (const id of collectHierarchyNodeIds(hierarchy)) {
        if (isUnderSuiteTarget(target, id)) {
          next[id] = 'pending';
        }
      }
    }
  });

  omitServerRunStatus(next, groups, hierarchyByEntryId);
  return next;
}
