import { childSuiteLeafPrefix } from './leafIdHelpers';

describe('childSuiteLeafPrefix', () => {
  it('returns undefined when no leafId present', () => {
    expect(childSuiteLeafPrefix(undefined)).toBeUndefined();
    expect(childSuiteLeafPrefix('')).toBeUndefined();
  });

  it('appends /s to simple leafIds', () => {
    expect(childSuiteLeafPrefix('root/0')).toBe('root/0/s');
  });

  it('chains /s for nested suites', () => {
    expect(childSuiteLeafPrefix('root/0/s/1')).toBe('root/0/s/1/s');
  });
});
