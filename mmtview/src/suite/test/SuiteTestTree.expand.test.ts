import { collectSuiteExpandableIds } from './SuiteTestTree';

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
