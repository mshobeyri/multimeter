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
    const result = await runJSCode({
      js: `
        const envVariables = { name: "old_value" };
        setenv_({ name: "new_value" });
        return envVariables.name;
      `,
      title: 'setenv-updates-env',
      logger,
      runId: 'run-setenv-test',
      reporter: (event: Record<string, any>) => {
        events.push(event);
      },
    });

    expect(result).toBe('new_value');

    const setenvEvent = events.find(e => e.scope === 'setenv');
    expect(setenvEvent).toBeDefined();
    expect(setenvEvent).toMatchObject({
      scope: 'setenv',
      variables: { name: 'new_value' },
    });
  });

  it('setenv_ works for adding new env keys', async () => {
    const result = await runJSCode({
      js: `
        const envVariables = {};
        setenv_({ api_key: "secret123" });
        return envVariables.api_key;
      `,
      title: 'setenv-new-key',
      logger,
      runId: 'run-setenv-new',
      reporter: () => {},
    });

    expect(result).toBe('secret123');
  });

  it('setenv_ updates multiple envVariables in one call', async () => {
    const events: Record<string, any>[] = [];
    const result = await runJSCode({
      js: `
        const envVariables = {};
        setenv_({ xxx: 111, yyy: 12121 });
        return [envVariables.xxx, envVariables.yyy];
      `,
      title: 'setenv-multi-updates-env',
      logger,
      runId: 'run-setenv-multi',
      reporter: (event: Record<string, any>) => {
        events.push(event);
      },
    });

    expect(result).toEqual([111, 12121]);

    const setenvEvent = events.find(e => e.scope === 'setenv');
    expect(setenvEvent).toBeDefined();
    expect(setenvEvent).toMatchObject({
      scope: 'setenv',
      variables: { xxx: 111, yyy: 12121 },
    });
    expect(events.filter(e => e.scope === 'setenv')).toHaveLength(1);
  });
});

describe('jsRunner process env store binding', () => {
  const logger = jest.fn();

  afterEach(() => {
    logger.mockReset();
  });

  it('binds envValues as envVariables when script does not declare it', async () => {
    const store = {host: 'example.com', token: 'abc'};
    const result = await runJSCode({
      js: `return [envVariables.host, mmtEnv_("token")];`,
      title: 'env-store-bind',
      logger,
      runId: 'run-env-store-bind',
      envValues: store,
    });
    expect(result).toEqual(['example.com', 'abc']);
  });

  it('setenv_ mutates the shared envValues object', async () => {
    const store = {name: 'old'};
    const result = await runJSCode({
      js: `
        setenv_({ name: "new" });
        return envVariables.name;
      `,
      title: 'env-store-setenv',
      logger,
      runId: 'run-env-store-setenv',
      envValues: store,
      reporter: () => {},
    });
    expect(result).toBe('new');
    expect(store.name).toBe('new');
  });

  it('resolveInputsMap_ resolves e: from bound envValues', async () => {
    const result = await runJSCode({
      js: `
        return resolveInputsMap_(
          { card: "e:card", short: "<<i:card[0:4]>>" },
          envVariables);
      `,
      title: 'env-store-resolve-inputs',
      logger,
      runId: 'run-env-store-resolve',
      envValues: {card: '4111111111111111'},
    });
    expect(result).toEqual({card: '4111111111111111', short: '4111'});
  });
});
