import {runJSCode} from './jsRunner';

describe('jsRunner reporter propagation', () => {
  const logger = jest.fn();

  afterEach(() => {
    logger.mockReset();
    const scope = globalThis as Record<string, any>;
    delete scope.__mmtReportStep;
    delete scope.__mmtRunId;
  });

  it('emits reporter events for helper checks and asserts', async () => {
    const events: Record<string, any>[] = [];
    await runJSCode({
      code: `
        report_('check', "foo > 1", undefined, false, 123, 456);
        report_('assert', "bar === 2", "custom", true);
      `,
      title: 'reporter-test',
      logger,
      runId: 'run-jsrunner-test',
      reporter: (event: Record<string, any>) => {
        events.push(event);
      },
    });

    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      scope: 'test-step',
      stepType: 'check',
      comparison: 'foo > 1',
      status: 'failed',
      runId: 'run-jsrunner-test',
      left: 123,
      right: 456,
    });
    expect(events[1]).toMatchObject({
      scope: 'test-step',
      stepType: 'assert',
      comparison: 'bar === 2',
      message: 'custom',
      status: 'passed',
    });
    expect(events[1].stepIndex).toBeGreaterThan(events[0].stepIndex);
  });

  it('restores any existing global reporter references', async () => {
    const scope = globalThis as Record<string, any>;
    const originalReporter = () => {};
    scope.__mmtReportStep = originalReporter;
    scope.__mmtRunId = 'persisted-run';

    await runJSCode({
      code: 'report_(\'check\', "noop", undefined, true);',
      title: 'restore-test',
      logger,
      runId: 'temporary-run',
      reporter: () => {},
    });

    expect(scope.__mmtReportStep).toBe(originalReporter);
    expect(scope.__mmtRunId).toBe('persisted-run');
  });
});
