import {createSuiteBundle} from './suiteBundle';

describe('createSuiteBundle (single target)', () => {
  it('builds deterministic ids and preserves children', () => {
    const hierarchy: any = {
      kind: 'suite',
      path: '/repo/root.suite.mmt',
      children: [
        {
          kind: 'group',
          label: 'Group 1',
          children: [
            {
              kind: 'suite',
              path: '/repo/child.suite.mmt',
              children: [
                {
                  kind: 'group',
                  label: 'Group 1',
                  children: [{kind: 'test', path: '/repo/api.mmt'}],
                },
              ],
            },
            {kind: 'test', path: '/repo/a.test.mmt'},
          ],
        },
      ],
    };

    const bundle = createSuiteBundle({
      rootSuitePath: '/repo/root.suite.mmt',
      hierarchy,
      target: undefined,
    });

    expect(bundle.rootSuitePath).toBe('/repo/root.suite.mmt');
    expect(Array.isArray(bundle.bundle)).toBe(true);
    expect(bundle.bundle.length).toBe(1);

    const root = bundle.bundle[0] as any;
    expect(root.kind).toBe('group');
    expect(root.id).toBe('suite-node:0');
    expect(Array.isArray(root.children)).toBe(true);
    expect(root.children.length).toBe(2);

    const suiteNode = root.children[0] as any;
    const testNode = root.children[1] as any;
    expect(suiteNode.kind).toBe('suite');
    expect(suiteNode.id).toBe('suite-node:0.0');
    expect(Array.isArray(suiteNode.children)).toBe(true);
    expect(suiteNode.children.length).toBe(1);

    const suiteGroup = suiteNode.children[0] as any;
    expect(suiteGroup.kind).toBe('group');
    expect(suiteGroup.id).toBe('suite-node:0.0.0');
    expect(Array.isArray(suiteGroup.children)).toBe(true);
    expect(suiteGroup.children.length).toBe(1);
    expect(suiteGroup.children[0].kind).toBe('test');
    expect(suiteGroup.children[0].id).toBe('suite-node:0.0.0.0');

    expect(testNode.kind).toBe('test');
    expect(testNode.id).toBe('suite-node:0.1');
  });

  it('stores target when provided', () => {
    const hierarchy: any = {kind: 'suite', path: '/repo/root.suite.mmt', children: []};
    const bundle = createSuiteBundle({
      rootSuitePath: '/repo/root.suite.mmt',
      hierarchy,
      target: 'some-target-id',
    });
    expect(bundle.target).toBe('some-target-id');
  });

  it('preserves titles from hierarchy nodes', () => {
    const hierarchy: any = {
      kind: 'suite',
      path: '/repo/root.suite.mmt',
      title: 'Root Suite Title',
      children: [
        {
          kind: 'group',
          label: 'Group 1',
          children: [
            {
              kind: 'suite',
              path: '/repo/child.suite.mmt',
              title: 'Child Suite Title',
              children: [
                {
                  kind: 'group',
                  label: 'Group 1',
                  children: [{kind: 'test', path: '/repo/nested-test.mmt', title: 'Nested Test Title'}],
                },
              ],
            },
            {kind: 'test', path: '/repo/direct-test.mmt', title: 'Direct Test Title'},
            {kind: 'server', path: '/repo/mock.mmt', title: 'Mock Server Title'},
          ],
        },
      ],
    };

    const bundle = createSuiteBundle({
      rootSuitePath: '/repo/root.suite.mmt',
      hierarchy,
      target: undefined,
    });

    const root = bundle.bundle[0] as any;
    expect(root.kind).toBe('group');

    const suiteNode = root.children[0] as any;
    expect(suiteNode.kind).toBe('suite');
    expect(suiteNode.title).toBe('Child Suite Title');

    const directTest = root.children[1] as any;
    expect(directTest.kind).toBe('test');
    expect(directTest.title).toBe('Direct Test Title');

    const serverNode = root.children[2] as any;
    expect(serverNode.kind).toBe('server');
    expect(serverNode.title).toBe('Mock Server Title');

    const nestedGroup = suiteNode.children[0] as any;
    const nestedTest = nestedGroup.children[0] as any;
    expect(nestedTest.kind).toBe('test');
    expect(nestedTest.title).toBe('Nested Test Title');
  });
});
