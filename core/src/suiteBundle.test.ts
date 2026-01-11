import {buildSuiteBundleFromHierarchy} from './suiteBundle';
import {SuiteHierarchyNode} from './suiteHierarchy';

describe('suiteBundle', () => {
  test('assigns random leafIds and runnableLeafIds', () => {
    const hierarchy: SuiteHierarchyNode[] = [
      {
        kind: 'group',
        label: 'Group 1',
        children: [
          {kind: 'test', path: '/t/a.mmt'},
          {kind: 'suite', path: '/s/child.mmt', children: [{kind: 'test', path: '/t/b.mmt'}]},
          {kind: 'missing', path: '/t/missing.mmt'},
        ],
      },
    ];

    const bundle = buildSuiteBundleFromHierarchy({
      rootSuitePath: '/s/root.mmt',
      hierarchy,
    });

    expect(bundle.nodes[0]).toMatchObject({kind: 'group', label: 'Group 1'});
    expect(typeof (bundle.nodes[0] as any).leafId).toBe('string');
    expect((bundle.nodes[0] as any).leafId.length).toBeGreaterThan(0);

    const group = bundle.nodes[0] as any;
    expect(group.children[0]).toMatchObject({kind: 'test', path: '/t/a.mmt'});
    expect(group.children[1]).toMatchObject({kind: 'suite', path: '/s/child.mmt'});
    expect(group.children[2]).toMatchObject({kind: 'missing', path: '/t/missing.mmt'});
    expect(typeof group.children[0].leafId).toBe('string');
    expect(typeof group.children[1].leafId).toBe('string');
    expect(typeof group.children[2].leafId).toBe('string');
    expect(group.children[0].leafId).not.toBe(group.children[1].leafId);

    const childSuite = group.children[1];
    expect(childSuite.children[0]).toMatchObject({kind: 'test', path: '/t/b.mmt'});
    expect(typeof childSuite.children[0].leafId).toBe('string');
    expect(childSuite.children[0].leafId).not.toBe(childSuite.leafId);

    expect(bundle.runnableLeafIds).toEqual([
      group.children[0].leafId,
      group.children[1].leafId,
    ]);
  });

  test('handles duplicates by position, not path', () => {
    const hierarchy: SuiteHierarchyNode[] = [
      {kind: 'test', path: '/t/dup.mmt'},
      {kind: 'test', path: '/t/dup.mmt'},
    ];

    const bundle = buildSuiteBundleFromHierarchy({
      rootSuitePath: '/s/root.mmt',
      hierarchy,
    });

    expect(bundle.nodes[0]).toMatchObject({kind: 'test', path: '/t/dup.mmt'});
    expect(bundle.nodes[1]).toMatchObject({kind: 'test', path: '/t/dup.mmt'});

    const leaf0 = (bundle.nodes[0] as any).leafId;
    const leaf1 = (bundle.nodes[1] as any).leafId;
    expect(typeof leaf0).toBe('string');
    expect(typeof leaf1).toBe('string');
    expect(leaf0).not.toBe(leaf1);
    expect(bundle.runnableLeafIds).toEqual([leaf0, leaf1]);
  });
});
