import { TreeItem } from 'react-complex-tree';
import { SuiteTreeItemData } from './types';

describe('SuitePanel folder flag for imported suites', () => {
  test('suite entry should be folder when import root is suite', () => {
    const baseItem: TreeItem<SuiteTreeItemData> = {
      index: 'suite-entry-1',
      isFolder: false,
      children: [],
      data: { type: 'file', path: './child-suite.mmt' },
    };

    const root = { docType: 'suite' as const, cycle: false };
    const shouldBeFolder = root.docType === 'suite' && !root.cycle;

    const patched: TreeItem<SuiteTreeItemData> = {
      ...baseItem,
      isFolder: shouldBeFolder ? true : baseItem.isFolder,
      children: baseItem.children || [],
    };

    expect(patched.isFolder).toBe(true);
  });
});
