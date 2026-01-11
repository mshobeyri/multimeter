import {buildSuiteHierarchyFromSuiteFile} from './suiteHierarchy';

describe('suiteHierarchy (core)', () => {
  test('expands imported suite into tests using fileLoader (relative paths)', async () => {
    const files: Record<string, string> = {
      '/root/root.mmt': ['type: suite', 'tests:', '  - ./suite1.mmt'].join('\n'),
      '/root/suite1.mmt': ['type: suite', 'title: suite 1', 'tests:', '  - test.mmt', '  - test1.mmt'].join('\n'),
      '/root/test.mmt': ['type: test'].join('\n'),
      '/root/test1.mmt': ['type: test'].join('\n'),
    };

    const fileLoader = async (p: string) => files[p] ?? '';

    const tree = await buildSuiteHierarchyFromSuiteFile({
      suiteFilePath: '/root/root.mmt',
      suiteRawText: files['/root/root.mmt'],
      fileLoader,
    });

        expect(tree).toEqual([
          {
            kind: 'suite',
            id: 'suite-node:0',
            path: '/root/suite1.mmt',
            children: [
              {kind: 'test', id: 'suite-node:0.0', path: '/root/test.mmt'},
              {kind: 'test', id: 'suite-node:0.1', path: '/root/test1.mmt'},
            ],
          },
        ]);
  });
});
