import {
  bundleIdFromExpandedTreeItem,
  computeReportStats,
  estimateReportBytes,
  estimateReportsMapBytes,
  expandedTreeItemsToReportNodeIds,
  pickReportNodeToSpill,
} from './reportSpillLogic';
import type { StepReportItem } from './TestStepReportPanel';

const sample = (id: string, details = 'x'): StepReportItem => ({
  stepIndex: 1,
  stepType: 'check',
  status: 'passed',
  title: id,
  details,
  expects: [],
  timestamp: 1,
});

describe('reportSpillLogic', () => {
  it('computes report stats', () => {
    expect(computeReportStats([
      sample('a'),
      { ...sample('b'), status: 'failed' },
    ])).toEqual({ passed: 1, failed: 1, stepCount: 2 });
  });

  it('picks the largest in-memory node to spill', () => {
    const map = {
      small: [sample('s', 'a')],
      large: [sample('l', 'a'.repeat(200))],
    };
    expect(pickReportNodeToSpill(map, new Set())).toBe('large');
    expect(pickReportNodeToSpill(map, new Set(['large']))).toBe('small');
    expect(pickReportNodeToSpill(map, new Set(), new Set(['large']))).toBe('small');
  });

  it('estimates total map bytes', () => {
    const total = estimateReportsMapBytes({
      a: [sample('a', 'hello')],
      b: [sample('b', 'world')],
    });
    expect(total).toBeGreaterThan(estimateReportBytes([sample('a', 'hello')]));
  });

  it('maps deeply nested expanded tree ids to bundle node ids', () => {
    expect(bundleIdFromExpandedTreeItem('suite-node:0::suite-node:0.1::suite-node:0.1.2'))
      .toBe('suite-node:0.1.2');
    expect(bundleIdFromExpandedTreeItem('suite-node:0')).toBe('suite-node:0');
  });

  it('prefers test item data id when resolving expanded report nodes', () => {
    const ids = expandedTreeItemsToReportNodeIds(
      ['entry::suite-node:0.1::suite-node:0.1.2'],
      {
        'entry::suite-node:0.1::suite-node:0.1.2': {
          data: { type: 'test', id: 'suite-node:0.1.2' },
        },
      },
    );
    expect(ids).toEqual(new Set(['suite-node:0.1.2']));
  });
});
