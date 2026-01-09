import { splitSuiteGroups } from './suiteImportTree';

describe('suite import tree group splitting', () => {
  test('builds 2 groups from suite tests list with then separator', () => {
    const tests = ['test.mmt', 'test1.mmt', 'test.mmt', 'then', 'test2.mmt', 'test1.mmt'];
    const groups = splitSuiteGroups(tests);
    expect(groups).toEqual([
      ['test.mmt', 'test1.mmt', 'test.mmt'],
      ['test2.mmt', 'test1.mmt'],
    ]);
  });
});
