import { buildSuiteInfoChildren, splitSuiteGroups } from './suiteImportTree';

describe('splitSuiteGroups', () => {
  test('splits on then marker and trims', () => {
    expect(splitSuiteGroups([' a ', 'b', 'then', ' c '])).toEqual([
      ['a', 'b'],
      ['c'],
    ]);
  });

  test('ignores empty entries', () => {
    expect(splitSuiteGroups(['', '  ', 'x'])).toEqual([['x']]);
  });

  test('handles multiple thens', () => {
    expect(splitSuiteGroups(['a', 'then', 'then', 'b'])).toEqual([['a'], ['b']]);
  });
});

describe('buildSuiteInfoChildren', () => {
  test('adds Suite info node first', () => {
    const children = buildSuiteInfoChildren('suite.mmt', [['a'], ['b']]);
    expect(children[0].path).toBe('Suite info');
    expect(children[0].id).toBe('suite-import-node:suite-info:suite.mmt');
  });

  test('creates group nodes for every group', () => {
    const children = buildSuiteInfoChildren('suite.mmt', [['a'], ['b'], ['c']]);
    expect(children.map((c) => c.path)).toEqual(['Suite info', 'Group 1', 'Group 2', 'Group 3']);
    expect(children.slice(1).every((n) => n.id.startsWith('suite-import-node:group:suite.mmt#'))).toBe(true);
  });
});
