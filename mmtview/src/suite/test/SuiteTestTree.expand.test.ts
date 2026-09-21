import { buildSuiteTestTreeItems, collectSuiteExpandableIds } from './SuiteTestTree';

describe('buildSuiteTestTreeItems', () => {
  it('includes nested hierarchy without expand state', () => {
    const groups = [
      {
        label: 'G',
        entries: [{ id: '1', path: './suite.mmt' }],
      },
    ];
    const baseItems = {
      'suite-root': {
        index: 'suite-root',
        isFolder: true,
        children: ['1'],
        data: { type: 'root', label: 'Suite' },
      },
      '1': {
        index: '1',
        isFolder: true,
        children: [],
        data: { type: 'suite', path: './suite.mmt', id: '1' },
      },
    } as any;
    const hierarchyByEntryId = {
      '1': {
        kind: 'suite',
        id: '1',
        path: './suite.mmt',
        children: [{ kind: 'test', id: '1.0', path: './t.mmt' }],
      },
    } as any;

    const items = buildSuiteTestTreeItems(groups as any, hierarchyByEntryId, baseItems);
    expect(items['1::1.0']).toBeDefined();
    expect(items['1'].children).toContain('1::1.0');
  });
});

describe('collectSuiteExpandableIds', () => {
  it('includes root, groups, entries, and nested hierarchy ids', () => {
    const groups = [
      {
        label: 'A',
        entries: [{ id: '0', path: './a.mmt' }],
      },
      {
        label: 'B',
        entries: [{ id: '1', path: './suite.mmt' }],
      },
    ];
    const hierarchyByEntryId = {
      '1': {
        kind: 'suite',
        id: '1',
        path: './suite.mmt',
        children: [
          {
            kind: 'group',
            id: '1.0',
            label: 'inner',
            children: [
              { kind: 'test', id: '1.0.0', path: './inner.mmt' },
            ],
          },
        ],
      },
    } as any;

    const ids = collectSuiteExpandableIds(groups, hierarchyByEntryId);
    // Single nested group is flattened into the parent, matching the tree UI.
    expect(ids).toEqual(expect.arrayContaining([
      'suite-root',
      'group-1',
      'group-2',
      '0',
      '1',
      '1::1.0.0',
    ]));
    expect(ids).not.toContain('1::1.0');
  });
});
