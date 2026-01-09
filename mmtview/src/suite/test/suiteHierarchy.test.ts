import { buildSuiteHierarchy } from './suiteHierarchy';

describe('suiteHierarchy', () => {
  test('flattens imported suite with a single group (no group wrapper)', () => {
    const lookup = {
      'suite1.mmt': { docType: 'suite', tests: ['test1.mmt'] },
      'test1.mmt': { docType: 'test' },
    } as any;

    const { rootEntries, lookup: lk } = { rootEntries: ['suite1.mmt'], lookup };
    const hierarchy = buildSuiteHierarchy({ rootEntries, lookup: lk });

    expect(hierarchy).toHaveLength(1);
    expect(hierarchy[0].kind).toBe('suite');

    const suiteNode = hierarchy[0] as any;
    expect(Array.isArray(suiteNode.groups)).toBe(true);
    expect(suiteNode.groups).toHaveLength(1);
    expect(suiteNode.groups[0].kind).toBe('test');
  });

  test('keeps group wrappers when imported suite has multiple groups', () => {
    const lookup = {
      'suite1.mmt': { docType: 'suite', tests: ['test1.mmt', 'then', 'test2.mmt'] },
      'test1.mmt': { docType: 'test' },
      'test2.mmt': { docType: 'test' },
    } as any;

    const hierarchy = buildSuiteHierarchy({ rootEntries: ['suite1.mmt'], lookup });
    const suiteNode = hierarchy[0] as any;

    expect(suiteNode.kind).toBe('suite');
    expect(suiteNode.groups).toHaveLength(2);
    expect(suiteNode.groups[0].kind).toBe('group');
    expect(suiteNode.groups[1].kind).toBe('group');
  });

  test('flattens root when only one group', () => {
    const lookup = {
      'test1.mmt': { docType: 'test' },
      'test2.mmt': { docType: 'test' },
    } as any;

    const hierarchy = buildSuiteHierarchy({ rootEntries: ['test1.mmt', 'test2.mmt'], lookup });
    expect(hierarchy).toHaveLength(2);
    expect(hierarchy[0].kind).toBe('test');
    expect(hierarchy[1].kind).toBe('test');
  });
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
