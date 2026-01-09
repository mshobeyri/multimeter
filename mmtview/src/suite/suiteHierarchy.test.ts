import { buildSuiteHierarchy } from './suiteHierarchy';

describe('suiteHierarchy', () => {
  it('builds final hierarchy for nested suite entries', () => {
    const rootEntries = ['suite1.mmt', './test/createSession.mmt'];
    const lookup = {
      'suite1.mmt': {
        docType: 'suite',
        tests: ['test.mmt'],
      },
      'test.mmt': {
        docType: 'test',
      },
      './test/createSession.mmt': {
        docType: 'test',
      },
    } as const;

    const tree = buildSuiteHierarchy({ rootEntries, lookup });

    expect(tree).toEqual([
      {
        kind: 'group',
        label: 'Group 1',
        children: [
          {
            kind: 'suite',
            path: 'suite1.mmt',
            groups: [
              {
                kind: 'group',
                label: 'Group 1',
                children: [
                  {
                    kind: 'test',
                    path: 'test.mmt',
                  },
                ],
              },
            ],
          },
          {
            kind: 'test',
            path: './test/createSession.mmt',
          },
        ],
      },
    ]);
  });

  it('splits root entries by then into groups', () => {
    const rootEntries = ['a.mmt', 'then', 'b.mmt'];
    const lookup = {
      'a.mmt': { docType: 'test' },
      'b.mmt': { docType: 'test' },
    } as const;

    expect(buildSuiteHierarchy({ rootEntries, lookup })).toEqual([
      { kind: 'group', label: 'Group 1', children: [{ kind: 'test', path: 'a.mmt' }] },
      { kind: 'group', label: 'Group 2', children: [{ kind: 'test', path: 'b.mmt' }] },
    ]);
  });
});
