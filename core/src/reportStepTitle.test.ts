import {reportStepTitle} from './reportStepTitle';

describe('reportStepTitle', () => {
  it('prefers an explicit title', () => {
    expect(reportStepTitle({title: 'echo', stepType: 'assert', stepIndex: 0})).toBe('echo');
  });

  it('defaults untitled assert/check/debug steps', () => {
    expect(reportStepTitle({stepType: 'assert', stepIndex: 0})).toBe('Assert');
    expect(reportStepTitle({stepType: 'check', stepIndex: 1})).toBe('Check');
    expect(reportStepTitle({stepType: 'debug', stepIndex: 2})).toBe('Debug');
  });

  it('falls back to step-N only when type is unknown', () => {
    expect(reportStepTitle({stepIndex: 3})).toBe('step-3');
  });
});
