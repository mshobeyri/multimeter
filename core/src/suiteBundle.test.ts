import {buildSuiteBundleFromHierarchy} from './suiteBundle';
import {SuiteHierarchyNode} from './suiteHierarchy';

describe('suiteBundle', () => {
  test('assigns deterministic nodeIds and runnableLeafIds', () => {
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

    expect(bundle.nodes[0]).toMatchObject({kind: 'group', nodeId: 'g:0', label: 'Group 1'});

    const group = bundle.nodes[0] as any;
    expect(group.children[0]).toMatchObject({kind: 'test', nodeId: 'g:0/i:0', path: '/t/a.mmt'});
    expect(group.children[1]).toMatchObject({kind: 'suite', nodeId: 'g:0/i:1', path: '/s/child.mmt'});
    expect(group.children[2]).toMatchObject({kind: 'missing', nodeId: 'g:0/i:2', path: '/t/missing.mmt'});

    const childSuite = group.children[1];
    expect(childSuite.children[0]).toMatchObject({kind: 'test', nodeId: 'g:0/i:1/i:0', path: '/t/b.mmt'});

    expect(bundle.runnableLeafIds).toEqual([
      'g:0/i:0',
      'g:0/i:1',
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

    expect(bundle.nodes[0]).toMatchObject({kind: 'test', nodeId: 'i:0', path: '/t/dup.mmt'});
    expect(bundle.nodes[1]).toMatchObject({kind: 'test', nodeId: 'i:1', path: '/t/dup.mmt'});
    expect(bundle.runnableLeafIds).toEqual(['i:0', 'i:1']);
  });
});
