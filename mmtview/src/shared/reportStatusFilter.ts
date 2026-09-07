import type { StepStatus } from './types';
import type { StepReportItem } from './TestStepReportPanel';

/** View-only filter for report / suite tree status. */
export type ReportStatusFilter =
  | 'all'
  | 'passed'
  | 'failed'
  | 'running'
  | 'running_failed';

export const REPORT_STATUS_FILTER_OPTIONS: { value: ReportStatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'passed', label: 'Passed' },
  { value: 'failed', label: 'Failed' },
  { value: 'running', label: 'Running' },
  { value: 'running_failed', label: 'Running | Failed' },
];

export function parseReportStatusFilter(value: unknown): ReportStatusFilter {
  if (
    value === 'passed' ||
    value === 'failed' ||
    value === 'running' ||
    value === 'running_failed' ||
    value === 'all'
  ) {
    return value;
  }
  return 'all';
}

/** Short empty-state copy when a status filter matches nothing. */
export function emptyReportFilterMessage(filter: ReportStatusFilter): string {
  if (filter === 'passed') {
    return 'No passed tests.';
  }
  if (filter === 'failed') {
    return 'No failed tests.';
  }
  if (filter === 'running') {
    return 'No running tests.';
  }
  if (filter === 'running_failed') {
    return 'No running or failed tests.';
  }
  return 'No tests to show.';
}

export function stepMatchesReportFilter(
  status: StepStatus | undefined,
  filter: ReportStatusFilter,
): boolean {
  if (filter === 'all') {
    return true;
  }
  if (filter === 'running') {
    return status === 'running';
  }
  if (filter === 'running_failed') {
    return status === 'running' || status === 'failed';
  }
  return status === filter;
}

export function filterStepReports(
  reports: StepReportItem[],
  filter: ReportStatusFilter,
): StepReportItem[] {
  if (filter === 'all' || reports.length === 0) {
    return reports;
  }
  return reports.filter((report) => stepMatchesReportFilter(report.status, filter));
}

export type FilterableTreeItem = {
  index: string | number;
  children?: (string | number)[];
  data?: unknown;
};

/**
 * View-only prune: keep leaves whose status matches the filter, and ancestors
 * that still have a matching descendant (or match themselves).
 */
export function filterTreeItemsByStatus<T extends FilterableTreeItem>(
  items: Record<string, T>,
  rootId: string,
  filter: ReportStatusFilter,
  statusForItem: (item: T) => StepStatus,
): Record<string, T> {
  if (filter === 'all') {
    return items;
  }

  const next: Record<string, T> = { ...items };

  const prune = (id: string): boolean => {
    const item = next[id];
    if (!item) {
      return false;
    }
    const childIds = Array.isArray(item.children)
      ? item.children.map((child) => String(child))
      : [];
    if (childIds.length === 0) {
      return stepMatchesReportFilter(statusForItem(item), filter);
    }
    const keptChildren = childIds.filter((childId) => prune(childId));
    next[id] = { ...item, children: keptChildren } as T;
    if (keptChildren.length > 0) {
      return true;
    }
    return stepMatchesReportFilter(statusForItem(item), filter);
  };

  prune(rootId);
  return next;
}
