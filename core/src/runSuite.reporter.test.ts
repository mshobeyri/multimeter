import {executeSuite} from './runSuite';
import {PreparedRun, RunFileResult} from './runCommon';
import {RunFileOptions, RunReporterMessage} from './runConfig';

describe('executeSuite reporter testId propagation', () => {
  it('adds testId to suite and child reporter events', async () => {
    const prepared: PreparedRun = {
      rawText: `type: suite\ntests:\n  - child-a.mmt\n`,
      filePath: '/tmp/suite.mmt',
      baseName: 'suite.mmt',
      docType: 'suite',
      envVarsUsed: {},
      inputsUsed: {},
      title: 'Suite Title',
    } as PreparedRun;

    const reporterEvents: RunReporterMessage[] = [];

    const runFileMock = jest.fn(async (opts: RunFileOptions): Promise<RunFileResult> => {
      opts.reporter && opts.reporter({
        scope: 'test-step',
        runId: 'child-run',
        stepIndex: 1,
        stepType: 'check',
        status: 'passed',
        comparison: '1 == 1',
        timestamp: Date.now(),
        testId: opts.testId,
      });
      return {
        js: '',
        result: {success: true, durationMs: 1, errors: []},
        identifier: 'child',
        displayName: 'child',
        docType: 'test',
        inputsUsed: {},
        envVarsUsed: {},
      };
    });

    await executeSuite(
        prepared,
        {
          file: prepared.rawText,
          fileType: 'raw',
          filePath: prepared.filePath,
          manualInputs: {},
          envvar: {},
          manualEnvvars: {},
          fileLoader: async () => 'type: test\nsteps:\n  - check: 1 == 1\n',
          jsRunner: async () => {},
          logger: () => {},
          reporter: (msg: RunReporterMessage) => reporterEvents.push(msg),
        } as any,
        [],
        runFileMock as any);

    expect(runFileMock).toHaveBeenCalledWith(expect.objectContaining({testId: '0:0'}));
    expect(reporterEvents.some(event => (event as any).scope === 'suite-item' && (event as any).testId === '0:0')).toBe(true);
    expect(reporterEvents.some(event => (event as any).scope === 'test-step' && (event as any).testId === '0:0')).toBe(true);
  });
});
