import { executeSuite, prepareSuiteRun } from './runSuite';
import { detectDocType } from './runCommon';

// Minimal suite YAML
const suiteYaml = `type: suite\ntitle: Cancel suite\nitems:\n  - test1.mmt\n  - then\n  - test2.mmt\n`;

describe('runSuite cancellation', () => {
  it('stops before starting next group when aborted', async () => {
    const controller = new AbortController();

    let loads = 0;
    const fileLoader = async (_p: string) => {
      loads += 1;
      // Abort as soon as the first child is requested.
      controller.abort();
      return 'type: test\nname: child\nsteps: []\n';
    };

    const prepared: any = {
      docType: detectDocType('suite.mmt', suiteYaml),
      baseName: 'suite.mmt',
      rawText: suiteYaml,
      title: 'Cancel suite',
      envVarsUsed: {},
      filePath: '/tmp/suite.mmt',
      ...prepareSuiteRun(suiteYaml, {}),
    };

    const options: any = {
      file: suiteYaml,
      fileType: 'raw',
      filePath: '/tmp/suite.mmt',
      manualInputs: {},
      envvar: {},
      manualEnvvars: {},
      fileLoader,
      jsRunner: async () => {},
      logger: () => {},
      reporter: () => {},
      abortSignal: controller.signal,
    };

    const runFile = async () => ({
      docType: 'test',
      displayName: 'child',
      identifier: 'child',
      js: '',
      result: { success: true, durationMs: 1, errors: [], logs: [] },
      inputsUsed: {},
      envVarsUsed: {},
    });

    const out = await executeSuite(prepared, options, [], runFile as any);
    expect(loads).toBeGreaterThanOrEqual(1);
    expect(out.result?.success).toBe(false);
  });

  it('skips tests when suite servers cannot start and still prepends preLogs', async () => {
    const yaml = `type: suite\ntitle: Servers\nservers:\n  - mock.mmt\nitems:\n  - test1.mmt\n`;
    const prepared: any = {
      docType: detectDocType('suite.mmt', yaml),
      baseName: 'suite.mmt',
      rawText: yaml,
      title: 'Servers',
      envVarsUsed: {},
      filePath: '/tmp/suite.mmt',
      ...prepareSuiteRun(yaml, {k: 1}),
    };
    const logs: string[] = [];
    const out = await executeSuite(prepared, {
      file: yaml,
      fileType: 'raw',
      filePath: '/tmp/suite.mmt',
      manualInputs: {},
      envvar: {},
      manualEnvvars: {},
      fileLoader: async () => 'type: test\nsteps: []\n',
      jsRunner: async () => {},
      logger: (_l: string, m: string) => logs.push(m),
      reporter: () => {},
    } as any, [{level: 'info', message: 'prelog'}], async () => {
      throw new Error('should not run children');
    });
    expect(out.result?.success).toBe(false);
    expect(logs.some(l => l.includes('no server runner'))).toBe(true);
    expect(out.result?.logs).toContain('prelog');
  });

  it('starts suite servers, registers them, and reports cleanup errors', async () => {
    const yaml = `type: suite\ntitle: Servers\nservers:\n  - ./mock.mmt\nitems:\n  - test1.mmt\n`;
    const prepared: any = {
      docType: detectDocType('suite.mmt', yaml),
      baseName: 'suite.mmt',
      rawText: yaml,
      title: 'Servers',
      envVarsUsed: {A: 1},
      filePath: '/tmp/suite.mmt',
      ...prepareSuiteRun(yaml, {}),
    };
    const logs: string[] = [];
    const out = await executeSuite(prepared, {
      file: yaml,
      fileType: 'raw',
      filePath: '/tmp/suite.mmt',
      manualInputs: {},
      envvar: {},
      projectRoot: '/tmp',
      fileLoader: async () => 'type: test\nsteps: []\n',
      jsRunner: async () => {},
      logger: (_l: string, m: string) => logs.push(m),
      reporter: () => {},
      serverRunner: async () => () => {
        throw new Error('stop failed');
      },
    } as any, [], async () => ({
      docType: 'test',
      displayName: 'child',
      identifier: 'child',
      js: '',
      result: {success: true, durationMs: 1, errors: [], logs: []},
      inputsUsed: {},
      envVarsUsed: {},
    }));
    expect(out.result?.success).toBe(true);
    expect(logs.some(l => l.includes('Error stopping server'))).toBe(true);
  });

  it('fails when a suite server throws and records child load failures', async () => {
    const yaml = `type: suite\ntitle: Boom\nservers:\n  - mock.mmt\nitems:\n  - test1.mmt\n`;
    const prepared: any = {
      docType: detectDocType('suite.mmt', yaml),
      baseName: 'suite.mmt',
      rawText: yaml,
      title: 'Boom',
      envVarsUsed: {},
      filePath: '/tmp/suite.mmt',
      ...prepareSuiteRun(yaml, {}),
    };
    const startFail = await executeSuite(prepared, {
      file: yaml,
      fileType: 'raw',
      filePath: '/tmp/suite.mmt',
      fileLoader: async () => 'type: test\nsteps: []\n',
      jsRunner: async () => {},
      logger: () => {},
      reporter: () => {},
      serverRunner: async () => {
        throw new Error('bind');
      },
    } as any, [], async () => ({result: {success: true}} as any));
    expect(startFail.result?.success).toBe(false);

    const noServerYaml = `type: suite\ntitle: Child fail\nitems:\n  - gone.mmt\n`;
    const prepared2: any = {
      docType: detectDocType('suite.mmt', noServerYaml),
      baseName: 'suite.mmt',
      rawText: noServerYaml,
      title: 'Child fail',
      envVarsUsed: {},
      filePath: '/tmp/suite.mmt',
      ...prepareSuiteRun(noServerYaml, {}),
    };
    const childFail = await executeSuite(prepared2, {
      file: noServerYaml,
      fileType: 'raw',
      filePath: '/tmp/suite.mmt',
      fileLoader: async () => {
        throw new Error('ENOENT gone');
      },
      jsRunner: async () => {},
      logger: () => {},
      reporter: () => {},
    } as any, [], async () => ({result: {success: true}} as any));
    expect(childFail.result?.success).toBe(false);
    expect(childFail.result?.errors.some((e: string) => e.includes('ENOENT'))).toBe(true);
  });

  it('cancels a parallel group member via a delayed abort flag', async () => {
    const yaml = `type: suite\ntitle: Parallel cancel\nitems:\n  - a.mmt\n  - b.mmt\n`;
    let reads = 0;
    const abortSignal = {
      get aborted() {
        reads += 1;
        return reads > 1;
      },
    };
    const prepared: any = {
      docType: detectDocType('suite.mmt', yaml),
      baseName: 'suite.mmt',
      rawText: yaml,
      title: 'Parallel cancel',
      envVarsUsed: {},
      filePath: '/tmp/suite.mmt',
      ...prepareSuiteRun(yaml, {}),
    };
    const out = await executeSuite(prepared, {
      file: yaml,
      fileType: 'raw',
      filePath: '/tmp/suite.mmt',
      fileLoader: async () => 'type: test\nsteps: []\n',
      jsRunner: async () => {},
      logger: () => {},
      reporter: () => {},
      abortSignal,
    } as any, [], async () => ({
      docType: 'test',
      displayName: 'child',
      identifier: 'child',
      js: '',
      result: {success: true, durationMs: 1, errors: [], logs: []},
      inputsUsed: {},
      envVarsUsed: {},
    }));
    expect(out.result?.success).toBe(false);
  });
});
