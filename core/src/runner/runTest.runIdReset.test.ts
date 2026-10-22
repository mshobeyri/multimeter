import {__testOnlyCreateRunId} from './runTest';

describe('runTest runId', () => {
  it('generates a new runId for each call', () => {
    const a = __testOnlyCreateRunId();
    const b = __testOnlyCreateRunId();
    expect(typeof a).toBe('string');
    expect(typeof b).toBe('string');
    expect(a).not.toEqual(b);
  });
});
