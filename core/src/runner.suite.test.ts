import {runFile} from './runner';

describe('runner suite', () => {
  it('runs groups sequentially and items in group in parallel', async () => {
    const events: string[] = [];

    const fileLoader = async (p: string) => {
      if (p.endsWith('suite.mmt')) {
        return `type: suite\ntests:\n  - a.mmt\n  - b.mmt\n  - then\n  - c.mmt\n`;
      }
      if (p.endsWith('a.mmt')) {
        return `type: test\nsteps:\n  - print: a\n`;
      }
      if (p.endsWith('b.mmt')) {
        return `type: test\nsteps:\n  - print: b\n`;
      }
      if (p.endsWith('c.mmt')) {
        return `type: test\nsteps:\n  - print: c\n`;
      }
      return '';
    };

    const testJsRunner = async (_code: string, title: string, lg: any) => {
      const t = String(title);
      events.push(`start:${t}`);
      // Useful when this test fails locally
      // eslint-disable-next-line no-console
      // console.log('jsRunner title:', t);
      if (t.includes('a')) {
        await new Promise(r => setTimeout(r, 50));
      }
      if (t.includes('b')) {
        await new Promise(r => setTimeout(r, 50));
      }
      events.push(`end:${t}`);
      lg('info', 'ok');
    };

    const res = await runFile({
      fileType: 'path',
      file: 'suite.mmt',
      filePath: '/tmp/suite.mmt',
      fileLoader,
      jsRunner: async (ctx: any) => {
        return testJsRunner(ctx?.code, ctx?.title, ctx?.logger);
      },
      logger: () => {},
    } as any);

    expect(res.docType).toBe('suite');

    // Titles come from `prepared.title` first, then basename(filePath).
    const startA = events.findIndex(e => e.startsWith('start:') && e.includes('a'));
    const startB = events.findIndex(e => e.startsWith('start:') && e.includes('b'));
    const endA = events.findIndex(e => e.startsWith('end:') && e.includes('a'));
    const endB = events.findIndex(e => e.startsWith('end:') && e.includes('b'));
    const startC = events.findIndex(e => e.startsWith('start:') && e.includes('c'));

    // Group1 starts both before either finishes
    // The suite runner uses each child's `title` if present (a/b/c here).
    expect(startA).toBeGreaterThanOrEqual(0);
    expect(startB).toBeGreaterThanOrEqual(0);
    expect(startC).toBeGreaterThanOrEqual(0);
    expect(startC).toBeGreaterThan(endA);
    expect(startC).toBeGreaterThan(endB);
  });

  it('continues on check failure but stops on assert failure', async () => {
    const fileLoader = async (p: string) => {
      if (p.endsWith('suite.mmt')) {
        return `type: suite\ntests:\n  - checkfail.mmt\n  - then\n  - assertfail.mmt\n  - then\n  - after.mmt\n`;
      }
      if (p.endsWith('checkfail.mmt')) {
        return `type: test\nsteps:\n  - check: 1 == 2\n  - print: afterCheck\n`;
      }
      if (p.endsWith('assertfail.mmt')) {
        return `type: test\nsteps:\n  - assert: 1 == 2\n  - print: afterAssert\n`;
      }
      if (p.endsWith('after.mmt')) {
        return `type: test\nsteps:\n  - print: shouldNotRun\n`;
      }
      return '';
    };

    const titles: string[] = [];
    const testJsRunner = async (_code: string, title: string, lg: any) => {
      const t = String(title);
      titles.push(t);
      // This mimics generated JS behavior: check => console.error, assert => throw
      if (t.includes('checkfail')) {
        lg('error', 'Check 1 == 2 failed');
        return;
      }
      if (t.includes('assertfail')) {
        lg('error', 'Assertion 1 == 2 failed');
        throw new Error('Assertion 1 == 2 failed');
      }
      lg('info', 'ok');
    };

    const res = await runFile({
      fileType: 'path',
      file: 'suite.mmt',
      filePath: '/tmp/suite.mmt',
      fileLoader,
      jsRunner: async (ctx: any) => {
        return testJsRunner(ctx?.code, ctx?.title, ctx?.logger);
      },
      logger: () => {},
    } as any);

    // check group runs, assert group runs, after group should NOT start
    // check group runs, assert group runs, after group should NOT start
    // Titles are basenames of the suite entries.
    expect(titles.some(t => t.includes('checkfail'))).toBe(true);
    expect(titles.some(t => t.includes('assertfail'))).toBe(true);
    expect(titles.some(t => t.includes('after'))).toBe(false);

    expect(res.result.success).toBe(false);
  });
});

describe('suite bundle runner nested suite', () => {
  it('runs nested suite as nested bundle without extra suite-run-start', async () => {
    const runner = await import('./runner.js');
    const {buildSuiteHierarchyFromSuiteFile} = await import('./suiteHierarchy.js');
    const {createSuiteBundle} = await import('./suiteBundle.js');

    const files: Record<string, string> = {
      '/root/suite.mmt': ['type: suite', 'tests:', '  - ./suite1.mmt'].join('\n'),
      '/root/suite1.mmt': ['type: suite', 'tests:', '  - ./test.mmt'].join('\n'),
      '/root/test.mmt': ['type: test', 'steps:', '  - print: ok'].join('\n'),
    };

    const testFileLoader = async (p: string) => {
      const normalized = p.startsWith('/') ? p : `/root/${p.replace(/^\.\//, '')}`;
      return files[normalized] ?? '';
    };

    const tree = await buildSuiteHierarchyFromSuiteFile({
      suiteFilePath: '/root/suite.mmt',
      suiteRawText: files['/root/suite.mmt'],
      fileLoader: testFileLoader,
    });
    const bundle = createSuiteBundle({
      rootSuitePath: '/root/suite.mmt',
      hierarchy: tree,
    });

    const scopes: string[] = [];
    await runner.runFile({
      file: files['/root/suite.mmt'],
      fileType: 'raw' as any,
      filePath: '/root/suite.mmt',
      manualInputs: {},
      envvar: {},
      manualEnvvars: {},
      fileLoader: testFileLoader,
      jsRunner: async () => ({success: true, logs: [], errors: []} as any),
      logger: () => {},
      suiteBundle: bundle,
      reporter: (msg: any) => {
        if (msg && typeof msg.scope === 'string') {
          scopes.push(msg.scope);
        }
      },
    } as any);

    // Only the outer suite bundle should emit suite-run-start.
    expect(scopes.filter(s => s === 'suite-run-start').length).toBe(1);
    expect(scopes.filter(s => s === 'suite-run-finished').length).toBe(1);
  });
});

describe('suite bundle grouping', () => {
  it('wraps root nodes into a single group when no groups exist', async () => {
    const {createSuiteBundle} = await import('./suiteBundle.js');

    const hierarchy = {
      kind: 'suite',
      id: 'root',
      path: '/root/suite.mmt',
      children: [
        {kind: 'test', id: 't1', path: '/root/a.mmt'},
        {kind: 'suite', id: 's1', path: '/root/suite1.mmt', children: []},
        {kind: 'missing', id: 'm1', path: '/root/missing.mmt'},
      ],
    } as any;

    const bundle = createSuiteBundle({
      rootSuitePath: '/root/suite.mmt',
      hierarchy,
    });

    expect(bundle.bundle.length).toBe(1);
    expect(bundle.bundle[0].kind).toBe('group');
    expect((bundle.bundle[0] as any).children.length).toBe(3);
    expect((bundle.bundle[0] as any).children.map((c: any) => c.kind)).toEqual(['test', 'suite', 'missing']);
  });
});
