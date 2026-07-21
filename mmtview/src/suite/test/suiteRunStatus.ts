import { StepStatus } from '../../shared/types';

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
