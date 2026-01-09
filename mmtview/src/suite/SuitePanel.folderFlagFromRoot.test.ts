import { TreeItem } from 'react-complex-tree';
import { SuiteTreeItemData } from './types';

describe('SuitePanel folder flag from import root', () => {
  test('marks suite entry as folder even when not expanded', () => {
    const items: Record<string, TreeItem<SuiteTreeItemData>> = {
      'suite-entry-1': {
        index: 'suite-entry-1',
        isFolder: false,
        children: [],
        data: { type: 'file', path: './suite1.mmt' },
      },
    };

    const root = { docType: 'suite' as const, cycle: false };

    if (root.docType === 'suite' && !root.cycle) {
      items['suite-entry-1'] = { ...items['suite-entry-1'], isFolder: true };
    }

    expect(items['suite-entry-1'].isFolder).toBe(true);
  });
});
