import { buildSuiteHierarchy, buildSuiteHierarchyFromYaml } from './suiteHierarchy';

describe('suiteHierarchy', () => {
  test('buildSuiteHierarchyFromYaml eagerly expands suites using readFile', () => {
    const files: Record<string, string> = {
      'root-suite.mmt': ['type: suite', 'tests:', '  - child-suite.mmt', '  - then', '  - leaf-test.mmt'].join('\n'),
      'child-suite.mmt': ['type: suite', 'tests:', '  - deep-test.mmt'].join('\n'),
      'leaf-test.mmt': ['type: test'].join('\n'),
      'deep-test.mmt': ['type: test'].join('\n'),
    };

    const tree = buildSuiteHierarchyFromYaml({
      suitePath: 'root-suite.mmt',
      suiteYaml: files['root-suite.mmt'],
      readFile: (p) => files[p],
    });

    expect(tree).toEqual([
      {
        kind: 'group',
        label: 'Group 1',
        children: [
          {
            kind: 'suite',
            path: 'child-suite.mmt',
            groups: [{ kind: 'test', path: 'deep-test.mmt' }],
          },
        ],
      },
      { kind: 'group', label: 'Group 2', children: [{ kind: 'test', path: 'leaf-test.mmt' }] },
    ]);
  });

  test('buildSuiteHierarchyFromYaml marks missing files as missing', () => {
    const rootYaml = ['type: suite', 'tests:', '  - missing-test.mmt'].join('\n');

    const tree = buildSuiteHierarchyFromYaml({
      suitePath: 'root-suite.mmt',
      suiteYaml: rootYaml,
      readFile: () => undefined,
    });

    expect(tree).toEqual([{ kind: 'missing', path: 'missing-test.mmt' }]);
  });

  test('buildSuiteHierarchyFromYaml ignores non-suite/test doc types', () => {
    const files: Record<string, string> = {
      'root-suite.mmt': ['type: suite', 'tests:', '  - api1.mmt', '  - test1.mmt', '  - env1.mmt'].join('\n'),
      'api1.mmt': ['type: api'].join('\n'),
      'test1.mmt': ['type: test'].join('\n'),
      'env1.mmt': ['type: env'].join('\n'),
    };

    const tree = buildSuiteHierarchyFromYaml({
      suitePath: 'root-suite.mmt',
      suiteYaml: files['root-suite.mmt'],
      readFile: (p) => files[p],
    });

    expect(tree).toEqual([{ kind: 'test', path: 'test1.mmt' }]);
  });

  test('buildSuiteHierarchyFromYaml detects cycles (A -> B -> A)', () => {
    const files: Record<string, string> = {
      'a.mmt': ['type: suite', 'tests:', '  - b.mmt'].join('\n'),
      'b.mmt': ['type: suite', 'tests:', '  - a.mmt'].join('\n'),
    };

    const tree = buildSuiteHierarchyFromYaml({
      suitePath: 'a.mmt',
      suiteYaml: files['a.mmt'],
      readFile: (p) => files[p],
    });

    expect(tree).toEqual([
      {
        kind: 'suite',
        path: 'b.mmt',
        groups: [{ kind: 'cycle', path: 'a.mmt' }],
      },
    ]);
  });

  test('flattens imported suite with a single group (no group wrapper)', () => {
    const lookup = {
      'suite1.mmt': { type: 'suite', tests: ['test1.mmt'] },
      'test1.mmt': { type: 'test' },
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
      'suite1.mmt': { type: 'suite', tests: ['test1.mmt', 'then', 'test2.mmt'] },
      'test1.mmt': { type: 'test' },
      'test2.mmt': { type: 'test' },
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
      'test1.mmt': { type: 'test' },
      'test2.mmt': { type: 'test' },
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
        type: 'suite',
        tests: ['test.mmt'],
      },
      'test.mmt': {
        type: 'test',
      },
      './test/createSession.mmt': {
        type: 'test',
      },
    } as const;

    const tree = buildSuiteHierarchy({ rootEntries, lookup });

    // Root has a single group (no `then`) so it is flattened.
    // Imported suite also has a single group, so its groups are flattened too.
    expect(tree).toEqual([
      {
        kind: 'suite',
        path: 'suite1.mmt',
        groups: [
          {
            kind: 'test',
            path: 'test.mmt',
          },
        ],
      },
      {
        kind: 'test',
        path: './test/createSession.mmt',
      },
    ]);
  });

  it('splits root entries by then into groups', () => {
    const rootEntries = ['a.mmt', 'then', 'b.mmt'];
    const lookup = {
      'a.mmt': { type: 'test' },
      'b.mmt': { type: 'test' },
    } as const;

    expect(buildSuiteHierarchy({ rootEntries, lookup })).toEqual([
      { kind: 'group', label: 'Group 1', children: [{ kind: 'test', path: 'a.mmt' }] },
      { kind: 'group', label: 'Group 2', children: [{ kind: 'test', path: 'b.mmt' }] },
    ]);
  });

  it('recursively expands nested suites to tests', () => {
    const rootEntries = ['suiteA.mmt'];
    const lookup = {
      'suiteA.mmt': { type: 'suite', tests: ['suiteB.mmt'] },
      // Note: suiteB not present in lookup on purpose.
    } as const;

    const resolve = (path: string) => {
      if (path === 'suiteB.mmt') {
        return { type: 'suite' as const, tests: ['deepTest.mmt'] };
      }
      if (path === 'deepTest.mmt') {
        return { type: 'test' as const };
      }
      return (lookup as any)[path];
    };

    expect(buildSuiteHierarchy({ rootEntries, lookup: lookup as any, resolve })).toEqual([
      {
        kind: 'suite',
        path: 'suiteA.mmt',
        groups: [
          {
            kind: 'suite',
            path: 'suiteB.mmt',
            groups: [{ kind: 'test', path: 'deepTest.mmt' }],
          },
        ],
      },
    ]);
  });

  it('ignores non-suite/test types when resolving', () => {
    const rootEntries = ['suite1.mmt'];
    const lookup = {
      'suite1.mmt': { type: 'suite', tests: ['api1.mmt', 'test1.mmt', 'env1.mmt'] },
      'api1.mmt': { type: 'api' },
      'test1.mmt': { type: 'test' },
      'env1.mmt': { type: 'env' },
    } as const;

    expect(buildSuiteHierarchy({ rootEntries, lookup: lookup as any })).toEqual([
      {
        kind: 'suite',
        path: 'suite1.mmt',
        groups: [{ kind: 'test', path: 'test1.mmt' }],
      },
    ]);
  });

  it('detects cycles across suites (A -> B -> A)', () => {
    const rootEntries = ['suiteA.mmt'];
    const lookup = {
      'suiteA.mmt': { type: 'suite', tests: ['suiteB.mmt'] },
      'suiteB.mmt': { type: 'suite', tests: ['suiteA.mmt'] },
    } as const;

    const tree = buildSuiteHierarchy({ rootEntries, lookup: lookup as any });
    expect(tree[0]).toEqual({
      kind: 'suite',
      path: 'suiteA.mmt',
      groups: [
        {
          kind: 'suite',
          path: 'suiteB.mmt',
          groups: [{ kind: 'cycle', path: 'suiteA.mmt' }],
        },
      ],
    });
  });

  it('detects self-cycle suite (A -> A)', () => {
    const rootEntries = ['suiteA.mmt'];
    const lookup = {
      'suiteA.mmt': { type: 'suite', tests: ['suiteA.mmt'] },
    } as const;

    const tree = buildSuiteHierarchy({ rootEntries, lookup: lookup as any });
    expect(tree).toEqual([
      {
        kind: 'suite',
        path: 'suiteA.mmt',
        groups: [{ kind: 'cycle', path: 'suiteA.mmt' }],
      },
    ]);
  });
});
