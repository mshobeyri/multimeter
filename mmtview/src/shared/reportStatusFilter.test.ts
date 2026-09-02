import {
  filterStepReports,
  filterTreeItemsByStatus,
  parseReportStatusFilter,
  stepMatchesReportFilter,
  emptyReportFilterMessage,
} from './reportStatusFilter';
import type { StepStatus } from './types';

describe('reportStatusFilter', () => {
  it('parses known filter values', () => {
    expect(parseReportStatusFilter('failed')).toBe('failed');
    expect(parseReportStatusFilter('passed')).toBe('passed');
    expect(parseReportStatusFilter('nope')).toBe('all');
  });

  it('emptyReportFilterMessage covers filter cases', () => {
    expect(emptyReportFilterMessage('passed')).toBe('No passed tests.');
    expect(emptyReportFilterMessage('failed')).toBe('No failed tests.');
    expect(emptyReportFilterMessage('all')).toBe('No tests to show.');
  });

  it('filters step reports by status without mutating source', () => {
    const reports = [
      { stepIndex: 0, stepType: 'check' as const, status: 'passed' as StepStatus, expects: [], timestamp: 1 },
      { stepIndex: 1, stepType: 'assert' as const, status: 'failed' as StepStatus, expects: [], timestamp: 2 },
      { stepIndex: 2, stepType: 'debug' as const, status: 'debug' as StepStatus, expects: [], timestamp: 3 },
    ];
    expect(filterStepReports(reports, 'all')).toHaveLength(3);
    expect(filterStepReports(reports, 'failed').map((r) => r.stepIndex)).toEqual([1]);
    expect(filterStepReports(reports, 'passed').map((r) => r.stepIndex)).toEqual([0]);
    expect(reports).toHaveLength(3);
  });

  it('keeps ancestors of matching tree leaves', () => {
    type Item = { index: string; children: string[]; data: { type: string; id?: string } };
    const items: Record<string, Item> = {
      root: { index: 'root', children: ['g1'], data: { type: 'root' } },
      g1: { index: 'g1', children: ['t1', 't2'], data: { type: 'group' } },
      t1: { index: 't1', children: [], data: { type: 'test', id: 'a' } },
      t2: { index: 't2', children: [], data: { type: 'test', id: 'b' } },
    };
    const statusForItem = (item: Item): StepStatus => {
      if (item.index === 't1') {
        return 'failed';
      }
      if (item.index === 't2') {
        return 'passed';
      }
      return 'default';
    };
    const filtered = filterTreeItemsByStatus(items, 'root', 'failed', statusForItem);
    expect(filtered.root.children).toEqual(['g1']);
    expect(filtered.g1.children).toEqual(['t1']);
    expect(stepMatchesReportFilter('failed', 'failed')).toBe(true);
  });
});
