import {reportWithContext_} from './testHelper';

describe('testHelper stepIndex reset', () => {
  it('resets stepIndex when runId changes (suite reruns)', () => {
    const events: any[] = [];
    const reporter = (e: any) => events.push(e);

    // Simulate suite child run #1
    reportWithContext_(reporter, 'suiteRunA:child1', 'id1', 'check', 'cmp', 't', 'd', true);
    reportWithContext_(reporter, 'suiteRunA:child1', 'id1', 'check', 'cmp', 't', 'd', true);

    // Simulate suite rerun: new runId should restart at 1.
    reportWithContext_(reporter, 'suiteRunB:child1', 'id1', 'check', 'cmp', 't', 'd', true);

    expect(events[0].stepIndex).toBe(1);
    expect(events[1].stepIndex).toBe(2);
    expect(events[2].stepIndex).toBe(1);
  });
});
