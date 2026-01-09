import { executeSuite, prepareSuiteRun } from './runSuite';
import { detectDocType } from './runCommon';

// Minimal suite YAML
const suiteYaml = `type: suite\ntitle: Cancel suite\ntests:\n  - test1.mmt\n  - then\n  - test2.mmt\n`;

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
});
