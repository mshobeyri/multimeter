import {createSuiteBundle} from './suiteBundle';

describe('createSuiteBundle (single target)', () => {
  it('builds deterministic ids and preserves children', () => {
    const hierarchy: any = [
      {
        kind: 'suite',
        path: '/repo/root.suite.mmt',
        children: [
          {kind: 'test', path: '/repo/a.test.mmt'},
          {
            kind: 'suite',
            path: '/repo/child.suite.mmt',
            children: [{kind: 'test', path: '/repo/api.mmt'}],
          },
        ],
      },
    ];

    const bundle = createSuiteBundle({
      rootSuitePath: '/repo/root.suite.mmt',
      hierarchy,
      target: undefined,
    });

    expect(bundle.rootSuitePath).toBe('/repo/root.suite.mmt');
    expect(Array.isArray(bundle.bundle)).toBe(true);
    expect(bundle.bundle.length).toBe(1);

    const root = bundle.bundle[0] as any;
    expect(root.kind).toBe('suite');
    expect(root.id).toBe('suite-node:0');
    expect(Array.isArray(root.children)).toBe(true);
    expect(root.children.length).toBe(2);

    const c0 = root.children[0] as any;
    const c1 = root.children[1] as any;
    expect(c0.kind).toBe('test');
    expect(c0.id).toBe('suite-node:0.0');

    expect(c1.kind).toBe('suite');
    expect(c1.id).toBe('suite-node:0.1');
    expect(Array.isArray(c1.children)).toBe(true);
    expect(c1.children.length).toBe(1);
    expect(c1.children[0].kind).toBe('test');
    expect(c1.children[0].id).toBe('suite-node:0.1.0');
  });

  it('stores target when provided', () => {
    const hierarchy: any = [{kind: 'suite', path: '/repo/root.suite.mmt', children: []}];
    const bundle = createSuiteBundle({
      rootSuitePath: '/repo/root.suite.mmt',
      hierarchy,
      target: 'some-target-id',
    });
    expect(bundle.target).toBe('some-target-id');
  });
});
