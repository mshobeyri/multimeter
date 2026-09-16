import {createSuiteNodeId} from './suiteNodeId';

describe('createSuiteNodeId', () => {
  test('uses suite-node prefix and joins index path', () => {
    expect(createSuiteNodeId([0, 1])).toBe('suite-node:0.1');
    expect(createSuiteNodeId([])).toBe('suite-node:root');
    expect(createSuiteNodeId([2], {prefix: '  leaf  '})).toBe('leaf:2');
  });

  test('keeps prefixes that already contain a colon', () => {
    expect(createSuiteNodeId([], {prefix: 'run:abc'})).toBe('run:abc');
    expect(createSuiteNodeId([1, 2], {prefix: 'run:abc'})).toBe('run:abc.1.2');
  });
});
