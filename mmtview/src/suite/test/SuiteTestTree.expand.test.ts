import {
  buildDefaultExpandedSuiteIds,
  buildSuiteTestTreeItems,
  collectSuiteExpandableIds,
  reconcileExpandedSuiteItems,
} from './SuiteTestTree';

describe('buildDefaultExpandedSuiteIds', () => {
  it('opens root for a single group suite', () => {
    expect(buildDefaultExpandedSuiteIds([{ label: 'G', entries: [{ id: '1', path: 'a.mmt' }] }]))
      .toEqual(['suite-root']);
  });

  it('opens root and every group folder for multi-group suites', () => {
    expect(buildDefaultExpandedSuiteIds([
      { label: 'G1', entries: [{ id: '1', path: 'a.mmt' }] },
      { label: 'G2', entries: [{ id: '2', path: 'b.mmt' }] },
    ])).toEqual(['suite-root', 'group-1', 'group-2']);
  });
});

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

describe('reconcileExpandedSuiteItems', () => {
  it('preserves user expansions when the tree grows without merging defaults', () => {
    const valid = new Set(['suite-root', '1', '1::1.0']);
    const next = reconcileExpandedSuiteItems(
      ['suite-root', '1::1.0'],
      valid,
      ['suite-root'],
      { mergeDefaults: false },
    );
    expect(next).toEqual(['suite-root', '1::1.0']);
  });

  it('falls back to defaults when nothing valid remains', () => {
    const next = reconcileExpandedSuiteItems(
      ['missing-id'],
      new Set(['suite-root']),
      ['suite-root'],
      { mergeDefaults: false },
    );
    expect(next).toEqual(['suite-root']);
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
