import type { TestRunResult, TestStepResult } from './reportCollector';

export interface ReportTreeNode {
  run: TestRunResult;
  /** Original index in the flat testRuns list (stable for HTML element ids). */
  index: number;
  children: ReportTreeNode[];
}

export function isGroupRun(run: TestRunResult): boolean {
  return run.docType === 'group';
}

/** Parent of `suite-node:0.1.2` is `suite-node:0.1`; `suite-node:0` → `suite-node:root`. */
export function parentSuiteNodeId(id: string | undefined): string | undefined {
  if (!id || !id.includes(':')) {
    return undefined;
  }
  const colon = id.lastIndexOf(':');
  const prefix = id.slice(0, colon);
  const path = id.slice(colon + 1);
  if (!path || path === 'root') {
    return undefined;
  }
  const parts = path.split('.');
  if (parts.length === 1) {
    return `${prefix}:root`;
  }
  return `${prefix}:${parts.slice(0, -1).join('.')}`;
}

function findAncestorId(
  id: string | undefined,
  byId: Map<string, ReportTreeNode>,
): string | undefined {
  const seen = new Set<string>();
  let current = parentSuiteNodeId(id);
  while (current && !seen.has(current)) {
    seen.add(current);
    if (byId.has(current)) {
      return current;
    }
    current = parentSuiteNodeId(current);
  }
  return undefined;
}

function collapseGroups(nodes: ReportTreeNode[]): ReportTreeNode[] {
  const out: ReportTreeNode[] = [];
  for (const node of nodes) {
    const kids = collapseGroups(node.children);
    if (isGroupRun(node.run)) {
      out.push(...kids);
    } else {
      out.push({run: node.run, index: node.index, children: kids});
    }
  }
  return out;
}

/**
 * Build a nestable report tree from flat suite/test runs.
 * Group nodes are omitted; their children are promoted to the parent.
 */
export function buildReportTree(runs: TestRunResult[]): ReportTreeNode[] {
  const nodes: ReportTreeNode[] = runs.map((run, index) => ({
    run,
    index,
    children: [],
  }));
  const byId = new Map<string, ReportTreeNode>();
  for (const node of nodes) {
    if (node.run.id) {
      byId.set(node.run.id, node);
    }
  }
  const roots: ReportTreeNode[] = [];
  for (const node of nodes) {
    const parentKey = findAncestorId(node.run.id, byId);
    if (parentKey) {
      byId.get(parentKey)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return collapseGroups(roots);
}

export function visibleReportSteps(run: TestRunResult): TestStepResult[] {
  return run.steps.filter(s => s.stepType !== 'debug');
}

export function isSuiteOnlyRun(run: TestRunResult): boolean {
  return run.docType === 'suite' && visibleReportSteps(run).length === 0;
}

/** Runs that appear in reports (excludes suite groups). */
export function reportableRuns(runs: TestRunResult[]): TestRunResult[] {
  return runs.filter(r => !isGroupRun(r));
}
