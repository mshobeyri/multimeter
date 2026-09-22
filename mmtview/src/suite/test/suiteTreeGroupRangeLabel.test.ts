import type { TreeItem } from 'react-complex-tree';
import type { SuiteTestTreeItemData } from './SuiteTestTree';
import {
  applyGroupChildrenRangeLabels,
  buildGroupChildrenRangeLabel,
  suiteTreeItemDisplayName,
  truncateGroupRangeSide,
} from './suiteTreeGroupRangeLabel';

describe('suiteTreeGroupRangeLabel', () => {
  it('uses title or path display rules for file rows', () => {
    expect(suiteTreeItemDisplayName({
      type: 'test',
      path: 'leaf/tests/test_01.mmt',
      id: '1',
      title: 'Alpha test',
      parentPath: 'bundles/core/suite.mmt',
    })).toBe('Alpha test');

    expect(suiteTreeItemDisplayName({
      type: 'suite',
      path: 'bundles/core/suite.mmt',
      id: '2',
      parentPath: '',
    })).toBe('suite.mmt');
  });

  it('builds a single-child range label without truncation', () => {
    const items: Record<string, TreeItem<SuiteTestTreeItemData>> = {
      group: {
        index: 'group',
        isFolder: true,
        children: ['child'],
        data: { type: 'group', label: 'Stage one' },
      },
      child: {
        index: 'child',
        isFolder: true,
        children: [],
        data: { type: 'test', path: 'a.mmt', id: 'c1', title: 'Only child' },
      },
    };
    expect(buildGroupChildrenRangeLabel(['child'], items)).toBe('Only child');
  });

  it('builds first..last labels with 30-char sides', () => {
    const first = 'A'.repeat(40);
    const last = 'Z'.repeat(40);
    const items: Record<string, TreeItem<SuiteTestTreeItemData>> = {
      group: {
        index: 'group',
        isFolder: true,
        children: ['a', 'b'],
        data: { type: 'group', label: 'Group' },
      },
      a: {
        index: 'a',
        isFolder: false,
        children: [],
        data: { type: 'test', path: 'a.mmt', id: '1', title: first },
      },
      b: {
        index: 'b',
        isFolder: false,
        children: [],
        data: { type: 'test', path: 'b.mmt', id: '2', title: last },
      },
    };
    expect(buildGroupChildrenRangeLabel(['a', 'b'], items)).toBe(
      `${truncateGroupRangeSide(first)}..${truncateGroupRangeSide(last)}`,
    );
  });

  it('annotates every group item in the tree map', () => {
    const items: Record<string, TreeItem<SuiteTestTreeItemData>> = {
      'group-1': {
        index: 'group-1',
        isFolder: true,
        children: ['entry'],
        data: { type: 'group', label: 'Group 1' },
      },
      entry: {
        index: 'entry',
        isFolder: true,
        children: [],
        data: { type: 'suite', path: 'nested/suite.mmt', id: 'entry' },
      },
    };
    const next = applyGroupChildrenRangeLabels(items);
    expect(next['group-1'].data).toMatchObject({
      type: 'group',
      childrenRangeLabel: 'suite.mmt',
    });
  });
});
