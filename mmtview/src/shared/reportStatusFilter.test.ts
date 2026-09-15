import {
  filterStepReports,
  filterTreeItemsByStatus,
  parseReportStatusFilter,
  stepMatchesReportFilter,
  emptyReportFilterMessage,
  REPORT_STATUS_FILTER_OPTIONS,
} from './reportStatusFilter';
import type { StepStatus } from './types';

describe('reportStatusFilter', () => {
  it('parses known filter values', () => {
    expect(parseReportStatusFilter('failed')).toBe('failed');
    expect(parseReportStatusFilter('errors')).toBe('errors');
    expect(parseReportStatusFilter('passed')).toBe('passed');
    expect(parseReportStatusFilter('running')).toBe('running');
    expect(parseReportStatusFilter('running_failed')).toBe('running_failed');
    expect(parseReportStatusFilter('skipped')).toBe('skipped');
    expect(parseReportStatusFilter('nope')).toBe('all');
  });

  it('lists running filter options', () => {
    expect(REPORT_STATUS_FILTER_OPTIONS.map((o) => o.value)).toEqual([
      'all',
      'passed',
      'failed',
      'errors',
      'running',
      'running_failed',
      'skipped',
    ]);
    expect(REPORT_STATUS_FILTER_OPTIONS.find((o) => o.value === 'running_failed')?.label)
      .toBe('Running | Failed');
  });

  it('emptyReportFilterMessage covers filter cases', () => {
    expect(emptyReportFilterMessage('passed')).toBe('No passed tests.');
    expect(emptyReportFilterMessage('failed')).toBe('No failed tests.');
    expect(emptyReportFilterMessage('errors')).toBe('No errors.');
    expect(emptyReportFilterMessage('running')).toBe('No running tests.');
    expect(emptyReportFilterMessage('running_failed')).toBe('No running or failed tests.');
    expect(emptyReportFilterMessage('skipped')).toBe('No skipped tests.');
    expect(emptyReportFilterMessage('all')).toBe('No tests to show.');
  });

  it('matches only running (not pending) for running filters', () => {
    expect(stepMatchesReportFilter('running', 'running')).toBe(true);
    expect(stepMatchesReportFilter('pending', 'running')).toBe(false);
    expect(stepMatchesReportFilter('failed', 'running')).toBe(false);
    expect(stepMatchesReportFilter('passed', 'running')).toBe(false);

    expect(stepMatchesReportFilter('running', 'running_failed')).toBe(true);
    expect(stepMatchesReportFilter('pending', 'running_failed')).toBe(false);
    expect(stepMatchesReportFilter('failed', 'running_failed')).toBe(true);
    expect(stepMatchesReportFilter('passed', 'running_failed')).toBe(false);
  });

  it('filters step reports by status without mutating source', () => {
    const reports = [
      { stepIndex: 0, stepType: 'check' as const, status: 'passed' as StepStatus, expects: [], timestamp: 1 },
      { stepIndex: 1, stepType: 'assert' as const, status: 'failed' as StepStatus, expects: [], timestamp: 2 },
      { stepIndex: 2, stepType: 'debug' as const, status: 'debug' as StepStatus, expects: [], timestamp: 3 },
      { stepIndex: 3, stepType: 'check' as const, status: 'running' as StepStatus, expects: [], timestamp: 4 },
      { stepIndex: 4, stepType: 'check' as const, status: 'invalid' as StepStatus, expects: [], timestamp: 5 },
    ];
    expect(filterStepReports(reports, 'all')).toHaveLength(5);
    expect(filterStepReports(reports, 'failed').map((r) => r.stepIndex)).toEqual([1]);
    expect(filterStepReports(reports, 'errors').map((r) => r.stepIndex)).toEqual([4]);
    expect(filterStepReports(reports, 'passed').map((r) => r.stepIndex)).toEqual([0]);
    expect(filterStepReports(reports, 'running').map((r) => r.stepIndex)).toEqual([3]);
    expect(filterStepReports(reports, 'running_failed').map((r) => r.stepIndex)).toEqual([1, 3]);
    expect(reports).toHaveLength(5);
  });

  it('keeps ancestors of matching tree leaves', () => {
    type Item = { index: string; children: string[]; data: { type: string; id?: string } };
    const items: Record<string, Item> = {
      root: { index: 'root', children: ['g1'], data: { type: 'root' } },
      g1: { index: 'g1', children: ['t1', 't2', 't3', 't4'], data: { type: 'group' } },
      t1: { index: 't1', children: [], data: { type: 'test', id: 'a' } },
      t2: { index: 't2', children: [], data: { type: 'test', id: 'b' } },
      t3: { index: 't3', children: [], data: { type: 'test', id: 'c' } },
      t4: { index: 't4', children: [], data: { type: 'test', id: 'd' } },
    };
    const statusForItem = (item: Item): StepStatus => {
      if (item.index === 't1') {
        return 'failed';
      }
      if (item.index === 't2') {
        return 'passed';
      }
      if (item.index === 't3') {
        return 'running';
      }
      if (item.index === 't4') {
        return 'invalid';
      }
      return 'default';
    };
    const failedOnly = filterTreeItemsByStatus(items, 'root', 'failed', statusForItem);
    expect(failedOnly.root.children).toEqual(['g1']);
    expect(failedOnly.g1.children).toEqual(['t1']);

    const runningFailed = filterTreeItemsByStatus(items, 'root', 'running_failed', statusForItem);
    expect(runningFailed.g1.children).toEqual(['t1', 't3']);
    expect(stepMatchesReportFilter('failed', 'failed')).toBe(true);

    const errorsOnly = filterTreeItemsByStatus(items, 'root', 'errors', statusForItem);
    expect(errorsOnly.g1.children).toEqual(['t4']);
    expect(stepMatchesReportFilter('invalid', 'errors')).toBe(true);
    expect(stepMatchesReportFilter('failed', 'errors')).toBe(false);
  });
});
