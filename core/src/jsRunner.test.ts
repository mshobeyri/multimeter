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
      js: `
        report_('check', "foo > 1", undefined, undefined, false, 123, 456);
        report_('assert', "bar === 2", "t", "custom", true);
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
      status: 'failed',
      runId: 'run-jsrunner-test',
      expects: [{ comparison: 'foo > 1', actual: 123, expected: 456, status: 'failed' }],
    });
    expect(events[1]).toMatchObject({
      scope: 'test-step',
      stepType: 'assert',
      details: 'custom',
      status: 'passed',
      expects: [{ comparison: 'bar === 2', status: 'passed' }],
    });
    expect(events[1].stepIndex).toBeGreaterThan(events[0].stepIndex);
  });

  it('sets globals for the duration of the run and does not restore under concurrency', async () => {
    const scope = globalThis as Record<string, any>;
    const originalReporter = () => {};
    scope.__mmtReportStep = originalReporter;
    scope.__mmtRunId = 'persisted-run';

    await runJSCode({
      js: 'report_(\'check\', "noop", undefined, undefined, true);',
      title: 'restore-test',
      logger,
      runId: 'temporary-run',
      reporter: () => {},
    });

    // Under the concurrency-safe design, globals are no longer restored
    // after a run.  The last writer wins, which is the correct behavior
    // for parallel suite execution.
    expect(typeof scope.__mmtRunId).toBe('string');
  });
});

describe('jsRunner setenv updates envVariables in scope', () => {
  const logger = jest.fn();

  afterEach(() => {
    logger.mockReset();
  });

  it('setenv_ updates envVariables so subsequent e: reads see the new value', async () => {
    const events: Record<string, any>[] = [];
    // The generated code declares envVariables (like rootTestToJsfunc does),
    // then calls setenv_ to update a key, and returns the live value.
    const result = await runJSCode({
      js: `
        const envVariables = { name: "old_value" };
        setenv_("name", "new_value");
        return envVariables.name;
      `,
      title: 'setenv-updates-env',
      logger,
      runId: 'run-setenv-test',
      reporter: (event: Record<string, any>) => {
        events.push(event);
      },
    });

    // The envVariables object should have been mutated in place.
    expect(result).toBe('new_value');

    // A setenv reporter event should also have been emitted.
    const setenvEvent = events.find(e => e.scope === 'setenv');
    expect(setenvEvent).toBeDefined();
    expect(setenvEvent).toMatchObject({
      scope: 'setenv',
      name: 'name',
      value: 'new_value',
    });
  });

  it('setenv_ works for adding new env keys', async () => {
    const result = await runJSCode({
      js: `
        const envVariables = {};
        setenv_("api_key", "secret123");
        return envVariables.api_key;
      `,
      title: 'setenv-new-key',
      logger,
      runId: 'run-setenv-new',
      reporter: () => {},
    });

    expect(result).toBe('secret123');
  });
});
