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

      expect(tree).toEqual({
        kind: 'suite',
        id: 'suite-node:root',
        path: '/root/root.mmt',
        title: undefined,
        children: [
          {
            kind: 'group',
            id: 'suite-node:0',
            label: 'Group 1',
            children: [
              {
                kind: 'suite',
                id: 'suite-node:0.0',
                path: '/root/suite1.mmt',
                title: 'suite 1',
                children: [
                  {
                    kind: 'group',
                    id: 'suite-node:0.0.0',
                    label: 'Group 1',
                    children: [
                      {kind: 'test', id: 'suite-node:0.0.0.0', path: '/root/test.mmt', title: undefined},
                      {kind: 'test', id: 'suite-node:0.0.0.1', path: '/root/test1.mmt', title: undefined},
                    ],
                  },
                ],
              },
            ],
          },
        ],
      });
  });
  
  test('nested suites with groups keep tests under group nodes', async () => {
    const files: Record<string, string> = {
      '/repo/root.suite.mmt': ['type: suite', 'tests:', '  - ./child.suite.mmt'].join('\n'),
      '/repo/child.suite.mmt': ['type: suite', 'tests:', '  - ./first.test.mmt', '  - then', '  - ./second.test.mmt'].join('\n'),
      '/repo/first.test.mmt': 'type: test\n',
      '/repo/second.test.mmt': 'type: test\n',
    };
    const fileLoader = async (p: string) => files[p] ?? '';

    const tree = await buildSuiteHierarchyFromSuiteFile({
      suiteFilePath: '/repo/root.suite.mmt',
      suiteRawText: files['/repo/root.suite.mmt'],
      fileLoader,
    });

      expect(tree).toEqual({
        kind: 'suite',
        id: 'suite-node:root',
        path: '/repo/root.suite.mmt',
        children: [
          {
            kind: 'group',
            id: 'suite-node:0',
            label: 'Group 1',
            children: [
              {
                kind: 'suite',
                id: 'suite-node:0.0',
                path: '/repo/child.suite.mmt',
                children: [
                  {
                    kind: 'group',
                    id: 'suite-node:0.0.0',
                    label: 'Group 1',
                    children: [
                      {kind: 'test', id: 'suite-node:0.0.0.0', path: '/repo/first.test.mmt'},
                    ],
                  },
                  {
                    kind: 'group',
                    id: 'suite-node:0.0.1',
                    label: 'Group 2',
                    children: [
                      {kind: 'test', id: 'suite-node:0.0.1.0', path: '/repo/second.test.mmt'},
                    ],
                  },
                ],
              },
            ],
          },
        ],
      });
  });

  test('suite hierarchy preserves groups and duplicate tests in nested suites', async () => {
    const files: Record<string, string> = {
      '/repo/suite.mmt': ['type: suite', 'tests:', '  - suite1.mmt'].join('\n'),
      '/repo/suite1.mmt': ['type: suite', 'tests:', '  - test.mmt', '  - test.mmt', '  - then', '  - test1.mmt'].join('\n'),
      '/repo/test.mmt': 'type: test\n',
      '/repo/test1.mmt': 'type: test\n',
    };
    const fileLoader = async (p: string) => files[p] ?? '';

    const tree = await buildSuiteHierarchyFromSuiteFile({
      suiteFilePath: '/repo/suite.mmt',
      suiteRawText: files['/repo/suite.mmt'],
      fileLoader,
    });

      expect(tree).toEqual({
        kind: 'suite',
        id: 'suite-node:root',
        path: '/repo/suite.mmt',
        children: [
          {
            kind: 'group',
            id: 'suite-node:0',
            label: 'Group 1',
            children: [
              {
                kind: 'suite',
                id: 'suite-node:0.0',
                path: '/repo/suite1.mmt',
                children: [
                  {
                    kind: 'group',
                    id: 'suite-node:0.0.0',
                    label: 'Group 1',
                    children: [
                      {kind: 'test', id: 'suite-node:0.0.0.0', path: '/repo/test.mmt'},
                      {kind: 'test', id: 'suite-node:0.0.0.1', path: '/repo/test.mmt'},
                    ],
                  },
                  {
                    kind: 'group',
                    id: 'suite-node:0.0.1',
                    label: 'Group 2',
                    children: [
                      {kind: 'test', id: 'suite-node:0.0.1.0', path: '/repo/test1.mmt'},
                    ],
                  },
                ],
              },
            ],
          },
        ],
      });
  });
});
