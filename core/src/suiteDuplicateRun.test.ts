import {runFile} from './runner';
import {buildSuiteHierarchyFromSuiteFile} from './suiteHierarchy';
import {createSuiteBundle} from './suiteBundle';

describe('duplicate nested suite with then', () => {
  it('runs the same nested suite twice across then', async () => {
    const files: Record<string, string> = {
      '/root/parent.mmt': [
        'type: suite',
        'title: Basic Suite M',
        'items:',
        '  - suite1.mmt',
        '  - then',
        '  - suite1.mmt',
      ].join('\n'),
      '/root/suite1.mmt': [
        'type: suite',
        'title: Basic Suite 1',
        'items:',
        '  - test.mmt',
      ].join('\n'),
      '/root/test.mmt': [
        'type: test',
        'title: Basic GET test',
        'steps:',
        '  - check: 1 == 2',
      ].join('\n'),
    };

    const fileLoader = async (p: string) => {
      const normalized = p.startsWith('/') ? p : `/root/${p.replace(/^\.\//, '')}`;
      return files[normalized] ?? '';
    };

    const tree = await buildSuiteHierarchyFromSuiteFile({
      suiteFilePath: '/root/parent.mmt',
      suiteRawText: files['/root/parent.mmt'],
      fileLoader,
    });

    expect(tree.children).toHaveLength(2);
    expect((tree.children[0] as any).children[0].kind).toBe('suite');
    expect((tree.children[1] as any).children[0].kind).toBe('suite');

    const bundle = createSuiteBundle({
      rootSuitePath: '/root/parent.mmt',
      hierarchy: tree,
    });

    const logs: string[] = [];

    await runFile({
      file: files['/root/parent.mmt'],
      fileType: 'raw' as any,
      filePath: '/root/parent.mmt',
      manualInputs: {},
      envvar: {},
      manualEnvvars: {},
      fileLoader,
      suiteBundle: bundle,
      jsRunner: async (ctx: any) => {
        ctx.logger('error', '× Check fail');
        if (typeof ctx.reporter === 'function') {
          ctx.reporter({
            scope: 'test-step',
            status: 'failed',
            stepType: 'check',
            title: 'Get JSON',
          });
        }
      },
      logger: (level: string, msg: string) => {
        logs.push(`[${level}] ${msg}`);
      },
      reporter: () => {},
    } as any);

    const suite1Finished =
        logs.filter(l => l.includes('Suite "Basic Suite 1"'));
    const parentFinished =
        logs.filter(l => l.includes('Suite "Basic Suite M"'));
    const suite1Starts =
        logs.filter(l => l.includes('Running suite item: Basic Suite 1'));

    expect(suite1Starts.length).toBe(2);
    expect(suite1Finished.length).toBe(2);
    expect(parentFinished.length).toBe(1);
  });

  it('still detects true recursive suite cycles', async () => {
    const files: Record<string, string> = {
      '/root/a.mmt': ['type: suite', 'items:', '  - b.mmt'].join('\n'),
      '/root/b.mmt': ['type: suite', 'items:', '  - a.mmt'].join('\n'),
    };
    const fileLoader = async (p: string) => {
      const normalized = p.startsWith('/') ? p : `/root/${p.replace(/^\.\//, '')}`;
      return files[normalized] ?? '';
    };

    const tree = await buildSuiteHierarchyFromSuiteFile({
      suiteFilePath: '/root/a.mmt',
      suiteRawText: files['/root/a.mmt'],
      fileLoader,
    });

    const nested = (tree.children[0] as any).children[0];
    expect(nested.kind).toBe('suite');
    const cycle = nested.children[0].children[0];
    expect(cycle.kind).toBe('cycle');
    expect(cycle.path).toBe('/root/a.mmt');
  });
});
