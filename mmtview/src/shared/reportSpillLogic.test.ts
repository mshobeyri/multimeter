import {
  computeReportStats,
  estimateReportBytes,
  estimateReportsMapBytes,
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
  });

  it('estimates total map bytes', () => {
    const total = estimateReportsMapBytes({
      a: [sample('a', 'hello')],
      b: [sample('b', 'world')],
    });
    expect(total).toBeGreaterThan(estimateReportBytes([sample('a', 'hello')]));
  });
});
