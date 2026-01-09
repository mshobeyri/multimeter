type StepReportItem = {
  stepIndex: number;
  stepType: 'check' | 'assert';
  status: 'passed' | 'failed';
  comparison: string;
  timestamp: number;
};

export {};

describe('suite leaf report routing', () => {
  it('appends test-step reports per leafId without overwriting other leaves', () => {
    const state: Record<string, StepReportItem[]> = {};

    const append = (leafId: string, report: StepReportItem) => {
      return {
        ...state,
        [leafId]: [...(state[leafId] || []), report],
      };
    };

    const r1: StepReportItem = {
      stepIndex: 1,
      stepType: 'check',
      status: 'passed',
      comparison: 'x == 1',
      timestamp: 1,
    };

    const r2: StepReportItem = {
      stepIndex: 1,
      stepType: 'assert',
      status: 'failed',
      comparison: 'y == 2',
      timestamp: 2,
    };

    Object.assign(state, append('0:0', r1));
    Object.assign(state, append('0:1', r2));

    expect(state['0:0']).toHaveLength(1);
    expect(state['0:1']).toHaveLength(1);
    expect(state['0:0'][0].comparison).toBe('x == 1');
    expect(state['0:1'][0].comparison).toBe('y == 2');
  });
});
