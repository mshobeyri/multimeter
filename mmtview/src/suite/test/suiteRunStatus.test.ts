import { ownRunStatus, isUnderSuiteTarget } from './suiteRunStatus';

describe('suiteRunStatus helpers', () => {
  it('allows all ids when there is no partial target', () => {
    expect(isUnderSuiteTarget(null, 'suite-node:1.0')).toBe(true);
    expect(isUnderSuiteTarget(undefined, 'anything')).toBe(true);
  });

  it('matches target and descendants by prefix', () => {
    expect(isUnderSuiteTarget('suite-node:1.1', 'suite-node:1.1')).toBe(true);
    expect(isUnderSuiteTarget('suite-node:1.1', 'suite-node:1.1.0.0')).toBe(true);
    expect(isUnderSuiteTarget('suite-node:1.1', 'suite-node:1.0')).toBe(false);
    expect(isUnderSuiteTarget('suite-node:1.1', 'suite-node:1.10')).toBe(false);
    expect(isUnderSuiteTarget('suite-node:1.1', null)).toBe(false);
  });

  it('reads own run status by id', () => {
    expect(ownRunStatus({ 'suite-node:1.0': 'failed' }, 'suite-node:1.0')).toBe('failed');
    expect(ownRunStatus({ 'suite-node:1.0': 'failed' }, 'suite-node:1.1')).toBe('default');
    expect(ownRunStatus({}, undefined)).toBe('default');
  });
});
