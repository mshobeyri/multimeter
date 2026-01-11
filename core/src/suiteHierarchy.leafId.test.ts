import {buildSuiteHierarchyFromSuiteFile} from './suiteHierarchy';

describe('suiteHierarchy leafId', () => {
  it('assigns distinct leafIds for duplicate paths', async () => {
    const fileLoader = async (p: string) => {
      if (p.endsWith('/root/suite.mmt')) {
        return `type: suite\n` +
            `tests:\n` +
            `  - ./dup.test.mmt\n` +
            `  - ./dup.test.mmt\n`;
      }
      if (p.endsWith('/root/dup.test.mmt')) {
        return `type: test\nsteps:\n  - print: ok\n`;
      }
      return '';
    };

    const tree = await buildSuiteHierarchyFromSuiteFile({
      suiteFilePath: '/root/suite.mmt',
      suiteRawText: await fileLoader('/root/suite.mmt'),
      fileLoader,
    });

    const leafIds = tree
        .filter((n: any) => n.kind === 'test')
        .map((n: any) => n.leafId);
    expect(leafIds.length).toBe(2);
    expect(leafIds[0]).toBeDefined();
    expect(leafIds[1]).toBeDefined();
    expect(leafIds[0]).not.toBe(leafIds[1]);
  });
});
