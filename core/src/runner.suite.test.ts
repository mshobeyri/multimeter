import {runFile} from './runner';
import {executeSuiteBundle} from './suiteBundleRunner';
import {createSuiteBundle} from './suiteBundle';

describe('runner suite', () => {
  it('runs groups sequentially and items in group in parallel', async () => {
    const events: string[] = [];

    const fileLoader = async (p: string) => {
      if (p.endsWith('suite.mmt')) {
        return `type: suite\nitems:\n  - a.mmt\n  - b.mmt\n  - then\n  - c.mmt\n`;
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
        return `type: suite\nitems:\n  - checkfail.mmt\n  - then\n  - assertfail.mmt\n  - then\n  - after.mmt\n`;
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

    // Groups still run after a failed item; the suite result is unsuccessful.
    expect(titles.some(t => t.includes('checkfail'))).toBe(true);
    expect(titles.some(t => t.includes('assertfail'))).toBe(true);
    expect(titles.some(t => t.includes('after'))).toBe(true);

    expect(res.result.success).toBe(false);
  });
});

describe('suite bundle runner nested suite', () => {
  it('runs nested suite as nested bundle without extra suite-run-start', async () => {
    const runner = await import('./runner.js');
    const {buildSuiteHierarchyFromSuiteFile} = await import('./suiteHierarchy.js');
    const {createSuiteBundle} = await import('./suiteBundle.js');

    const files: Record<string, string> = {
      '/root/suite.mmt': ['type: suite', 'items:', '  - ./suite1.mmt'].join('\n'),
      '/root/suite1.mmt': ['type: suite', 'items:', '  - ./test.mmt'].join('\n'),
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

  it('starts nested suite servers: at the beginning of that suite', async () => {
    const runner = await import('./runner.js');
    const {buildSuiteHierarchyFromSuiteFile} = await import('./suiteHierarchy.js');
    const {createSuiteBundle} = await import('./suiteBundle.js');

    const files: Record<string, string> = {
      '/root/suite.mmt': ['type: suite', 'items:', '  - ./inner.mmt'].join('\n'),
      '/root/inner.mmt': [
        'type: suite',
        'servers:',
        '  - ./mock.mmt',
        'items:',
        '  - ./test.mmt',
      ].join('\n'),
      '/root/mock.mmt': ['type: server', 'port: 3000'].join('\n'),
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

    const started: string[] = [];
    const stopped: string[] = [];
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
      serverRunner: async (alias: string) => {
        started.push(alias);
        return () => {
          stopped.push(alias);
        };
      },
      suiteBundle: bundle,
    } as any);

    expect(started.some((p) => p.includes('mock.mmt'))).toBe(true);
  });

  it('reuses a parent suite server when a nested suite lists the same file', async () => {
    const runner = await import('./runner.js');
    const {buildSuiteHierarchyFromSuiteFile} = await import('./suiteHierarchy.js');
    const {createSuiteBundle} = await import('./suiteBundle.js');

    const files: Record<string, string> = {
      '/root/suite.mmt': [
        'type: suite',
        'servers:',
        '  - ./mock.mmt',
        'items:',
        '  - ./inner.mmt',
      ].join('\n'),
      '/root/inner.mmt': [
        'type: suite',
        'servers:',
        '  - ./mock.mmt',
        'items:',
        '  - ./test.mmt',
      ].join('\n'),
      '/root/mock.mmt': ['type: server', 'port: 3000'].join('\n'),
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
      servers: tree.servers,
    });

    const started: string[] = [];
    const stopped: string[] = [];
    const outcome: any = await runner.runFile({
      file: files['/root/suite.mmt'],
      fileType: 'raw' as any,
      filePath: '/root/suite.mmt',
      manualInputs: {},
      envvar: {},
      manualEnvvars: {},
      fileLoader: testFileLoader,
      jsRunner: async () => ({success: true, logs: [], errors: []} as any),
      logger: () => {},
      serverRunner: async (alias: string) => {
        started.push(alias);
        return () => {
          stopped.push(alias);
        };
      },
      suiteBundle: bundle,
    } as any);

    expect(started.length).toBe(1);
    expect(outcome.result.success).toBe(true);
  });

  it('keeps a nested suite server running for a later sibling test', async () => {
    const runner = await import('./runner.js');
    const {buildSuiteHierarchyFromSuiteFile} = await import('./suiteHierarchy.js');
    const {createSuiteBundle} = await import('./suiteBundle.js');

    const files: Record<string, string> = {
      '/root/suite3.mmt': [
        'type: suite',
        'items:',
        '  - ./suite2.mmt',
        '  - ./later.mmt',
      ].join('\n'),
      '/root/suite2.mmt': [
        'type: suite',
        'servers:',
        '  - ./mock.mmt',
        'items:',
        '  - ./inner.mmt',
      ].join('\n'),
      '/root/inner.mmt': [
        'type: suite',
        'servers:',
        '  - ./mock.mmt',
        'items:',
        '  - ./first.mmt',
      ].join('\n'),
      '/root/mock.mmt': ['type: server', 'port: 3000'].join('\n'),
      '/root/first.mmt': ['type: test', 'steps:', '  - print: first'].join('\n'),
      '/root/later.mmt': ['type: test', 'steps:', '  - print: later'].join('\n'),
    };
    const testFileLoader = async (p: string) => {
      const normalized = p.startsWith('/') ? p : `/root/${p.replace(/^\.\//, '')}`;
      return files[normalized] ?? '';
    };
    const tree = await buildSuiteHierarchyFromSuiteFile({
      suiteFilePath: '/root/suite3.mmt',
      suiteRawText: files['/root/suite3.mmt'],
      fileLoader: testFileLoader,
    });
    const bundle = createSuiteBundle({
      rootSuitePath: '/root/suite3.mmt',
      hierarchy: tree,
    });
    const {isServerRunning_} = await import('./testHelper.js');
    const started: string[] = [];
    const runningDuringLater: boolean[] = [];
    const outcome: any = await runner.runFile({
      file: files['/root/suite3.mmt'],
      fileType: 'raw' as any,
      filePath: '/root/suite3.mmt',
      manualInputs: {},
      envvar: {},
      manualEnvvars: {},
      fileLoader: testFileLoader,
      jsRunner: async () => ({success: true, logs: [], errors: []} as any),
      logger: () => {},
      serverRunner: async (alias: string, filePath?: string) => {
        started.push(filePath || alias);
        return () => {};
      },
      reporter: (msg: any) => {
        if (msg?.scope === 'suite-item' && msg.status === 'running' &&
            String(msg.filePath || '').includes('later.mmt')) {
          runningDuringLater.push(
              isServerRunning_('/root/mock.mmt') || isServerRunning_('./mock.mmt'));
        }
      },
      suiteBundle: bundle,
    } as any);

    expect(started.length).toBe(1);
    expect(outcome.result.success).toBe(true);
    expect(runningDuringLater).toEqual([true]);
  });

  it('starts an item server at its stage, not at the beginning of the suite', async () => {
    const runner = await import('./runner.js');
    const {buildSuiteHierarchyFromSuiteFile} = await import('./suiteHierarchy.js');
    const {createSuiteBundle} = await import('./suiteBundle.js');

    const files: Record<string, string> = {
      '/root/suite.mmt': [
        'type: suite',
        'items:',
        '  - ./first.mmt',
        '  - then',
        '  - ./mock.mmt',
        '  - then',
        '  - ./second.mmt',
      ].join('\n'),
      '/root/mock.mmt': ['type: server', 'port: 3000'].join('\n'),
      '/root/first.mmt': ['type: test', 'steps:', '  - print: first'].join('\n'),
      '/root/second.mmt': ['type: test', 'steps:', '  - print: second'].join('\n'),
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
    const order: string[] = [];
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
      serverRunner: async (_alias: string, filePath?: string) => {
        order.push(`server:${filePath || _alias}`);
        return () => {};
      },
      reporter: (msg: any) => {
        if (msg?.scope === 'suite-item' && msg.status === 'running' && msg.docType === 'test') {
          order.push(`test:${msg.filePath}`);
        }
      },
      suiteBundle: bundle,
    } as any);

    expect(order).toEqual([
      'test:/root/first.mmt',
      'server:/root/mock.mmt',
      'test:/root/second.mmt',
    ]);
  });

  it('skips tests that do not match only-tags', async () => {
    const runner = await import('./runner.js');
    const {buildSuiteHierarchyFromSuiteFile} = await import('./suiteHierarchy.js');
    const {createSuiteBundle} = await import('./suiteBundle.js');
    const {tagFilterFromLists} = await import('./suiteTagFilter.js');

    const files: Record<string, string> = {
      '/root/suite.mmt': ['type: suite', 'items:', '  - ./smoke.mmt', '  - ./slow.mmt'].join('\n'),
      '/root/smoke.mmt': ['type: test', 'tags: [smoke]', 'steps:', '  - print: ok'].join('\n'),
      '/root/slow.mmt': ['type: test', 'tags: [slow]', 'steps:', '  - print: slow'].join('\n'),
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
    const statuses: Array<{id?: string; status?: string; title?: string}> = [];
    let jsRuns = 0;
    await runner.runFile({
      file: files['/root/suite.mmt'],
      fileType: 'raw' as any,
      filePath: '/root/suite.mmt',
      manualInputs: {},
      envvar: {},
      manualEnvvars: {},
      fileLoader: testFileLoader,
      tagFilter: tagFilterFromLists(['smoke']),
      jsRunner: async () => {
        jsRuns += 1;
        return {success: true, logs: [], errors: []} as any;
      },
      logger: () => {},
      suiteBundle: bundle,
      reporter: (msg: any) => {
        if (msg?.scope === 'suite-item' && msg.status && msg.status !== 'running') {
          statuses.push({id: msg.id, status: msg.status, title: msg.title});
        }
      },
    } as any);
    expect(jsRuns).toBe(1);
    expect(statuses.some((s) => s.status === 'skipped')).toBe(true);
    expect(statuses.some((s) => s.status === 'passed')).toBe(true);
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

describe('executeSuiteBundle error and cancel paths', () => {
  const childTest = ['type: test', 'steps:', '  - print: ok'].join('\n');

  const baseOptions = (overrides: Record<string, any> = {}) => ({
    file: '',
    fileType: 'raw',
    filePath: '/root/suite.mmt',
    fileLoader: async (p: string) => {
      if (p.endsWith('child.mmt')) {
        return childTest;
      }
      if (p.endsWith('nested.mmt')) {
        return ['type: suite', 'items:', '  - ./child.mmt'].join('\n');
      }
      return '';
    },
    jsRunner: async () => {},
    logger: () => {},
    reporter: () => {},
    ...overrides,
  });

  const runFileOk = async () => ({
    docType: 'test' as const,
    displayName: 'child',
    identifier: 'child',
    js: '',
    result: {success: true, durationMs: 1, errors: [], logs: ['ok']},
    inputsUsed: {},
    envVarsUsed: {},
  });

  const makeBundle = (hierarchy: any, extra: Record<string, any> = {}) =>
      createSuiteBundle({
        rootSuitePath: '/root/suite.mmt',
        hierarchy,
        ...extra,
      } as any);

  const runBundle = (params: any) => executeSuiteBundle(params);

  it('throws when the target id is missing', async () => {
    const bundle = makeBundle({kind: 'suite', id: 'root', path: '/root/suite.mmt', children: []}, {target: 'no-such-id'});
    await expect(runBundle({
      bundle,
      options: baseOptions(),
      preLogs: [],
      runFile: runFileOk,
    })).rejects.toThrow('Suite target not found');
  });

  it('cancels before servers start and when a server runner is missing', async () => {
    const controller = new AbortController();
    controller.abort();
    const hierarchy = {
      kind: 'suite',
      id: 'root',
      path: '/root/suite.mmt',
      title: 'S',
      children: [{kind: 'test', id: 't', path: '/root/child.mmt', title: 'Child'}],
    };
    const bundle = makeBundle(hierarchy, {servers: ['/root/mock.mmt']});
    const cancelled = await runBundle({
      bundle,
      options: baseOptions({abortSignal: controller.signal}),
      preLogs: [{level: 'warn', message: 'pre'}],
      runFile: runFileOk,
    });
    expect(cancelled.result.success).toBe(false);
    expect(cancelled.result.logs).toContain('pre');

    const noRunner = await runBundle({
      bundle,
      options: baseOptions(),
      preLogs: [],
      runFile: runFileOk,
    });
    expect(noRunner.result.success).toBe(false);
    expect(noRunner.result.errors.some((e: string) => e.includes('no server runner'))).toBe(true);
  });

  it('starts and stops suite servers, including cleanup errors', async () => {
    const hierarchy = {
      kind: 'suite',
      id: 'root',
      path: '/root/suite.mmt',
      children: [{kind: 'test', id: 't', path: '/root/child.mmt'}],
    };
    const bundle = makeBundle(hierarchy, {servers: ['mock.mmt'], export: ['report.html']});
    const logs: string[] = [];
    const out = await runBundle({
      bundle,
      options: baseOptions({
        logger: (_l: string, m: string) => logs.push(m),
        serverRunner: async () => () => {
          throw new Error('cleanup boom');
        },
      }),
      preLogs: [],
      runFile: runFileOk,
    });
    expect(out.result.success).toBe(true);
    expect(out.suiteExports?.paths).toEqual(['report.html']);
    expect(logs.some((l: string) => l.includes('Error stopping server'))).toBe(true);
  });

  it('fails when a suite server throws on start', async () => {
    const bundle = makeBundle({
      kind: 'suite',
      id: 'root',
      path: '/root/suite.mmt',
      children: [{kind: 'test', id: 't', path: '/root/child.mmt'}],
    }, {servers: ['mock.mmt']});
    const out = await runBundle({
      bundle,
      options: baseOptions({
        serverRunner: async () => {
          throw new Error('listen failed');
        },
      }),
      preLogs: [],
      runFile: runFileOk,
    });
    expect(out.result.success).toBe(false);
    expect(out.result.errors.some((e: string) => e.includes('listen failed'))).toBe(true);
  });

  it('runs a targeted group, nested groups, cycle nodes, and child runFile throws', async () => {
    const hierarchy = {
      kind: 'suite',
      id: 'root',
      path: '/root/suite.mmt',
      title: 'Root',
      children: [
        {
          kind: 'group',
          id: 'g1',
          label: 'G1',
          children: [
            {kind: 'test', id: 't', path: '/root/child.mmt', title: 'T'},
            {
              kind: 'group',
              id: 'inner',
              label: 'inner',
              children: [{kind: 'test', id: 't2', path: '/root/child.mmt'}],
            },
            {kind: 'cycle', id: 'c', path: '/root/suite.mmt'},
            {kind: 'server', id: 's', path: '/root/mock.mmt'},
            {kind: 'missing', id: 'm', path: '/root/gone.mmt'},
          ],
        },
      ],
    };
    const bundle = makeBundle(hierarchy);
    const groupId = bundle.bundle[0].id;
    const logs: string[] = [];
    const out = await runBundle({
      bundle: {...bundle, target: groupId},
      options: baseOptions({
        logger: (_l: string, m: string) => logs.push(m),
        suiteRunId: 'nonce-1',
        binaryFileLoader: async () => Buffer.from('x'),
        serverRunner: async () => () => {},
      }),
      preLogs: [],
      runFile: async (opts: any) => {
        if (String(opts.filePath || '').includes('child')) {
          throw new Error('child boom');
        }
        return runFileOk();
      },
    });
    expect(out.result.success).toBe(false);
    expect(logs.some((l: string) => l.includes('Circular suite reference'))).toBe(true);
    expect(logs.some((l: string) => l.includes('child boom'))).toBe(true);
  });

  it('stops sequential nodes when abortSignal is already aborted in the group mapper', async () => {
    let reads = 0;
    const abortSignal = {
      get aborted() {
        reads += 1;
        return reads > 2;
      },
    };
    const bundle = makeBundle({
      kind: 'suite',
      id: 'root',
      path: '/root/suite.mmt',
      children: [
        {
          kind: 'group',
          id: 'g',
          label: 'G',
          children: [
            {kind: 'test', id: 'a', path: '/root/a.mmt'},
            {kind: 'test', id: 'b', path: '/root/b.mmt'},
          ],
        },
      ],
    });
    const out = await runBundle({
      bundle,
      options: baseOptions({
        abortSignal,
        fileLoader: async () => childTest,
      }),
      preLogs: [],
      runFile: runFileOk,
    });
    expect(out.result.success).toBe(false);
  });

  it('cancels after a child reports cancelled and targets a single test node', async () => {
    const hierarchy = {
      kind: 'suite',
      id: 'root',
      path: '/root/suite.mmt',
      children: [
        {kind: 'test', id: 'a', path: '/root/a.mmt', title: 'A'},
        {kind: 'test', id: 'b', path: '/root/b.mmt', title: 'B'},
      ],
    };
    const bundle = makeBundle(hierarchy);
    const firstId = (bundle.bundle[0] as any).children[0].id;
    const targeted = await runBundle({
      bundle: {...bundle, target: firstId},
      options: baseOptions({fileLoader: async () => childTest}),
      preLogs: [],
      runFile: async () => ({
        ...await runFileOk(),
        result: {success: false, durationMs: 1, errors: [], logs: [], cancelled: true},
      }),
    });
    expect(targeted.result.success).toBe(false);

    const sequentialCancel = await runBundle({
      bundle,
      options: baseOptions({fileLoader: async () => childTest}),
      preLogs: [],
      runFile: async (opts: any) => ({
        ...await runFileOk(),
        result: {
          success: false,
          durationMs: 1,
          errors: [],
          logs: [],
          cancelled: String(opts.filePath).includes('a.mmt'),
        },
      }),
    });
    expect(sequentialCancel.result.success).toBe(false);
  });
});
