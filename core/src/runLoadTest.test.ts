import {executeLoadTest} from './runLoadTest';
import {PreparedRun, RunFileResult} from './runCommon';
import {RunFileOptions} from './runConfig';

function makePrepared(rawText: string): PreparedRun {
  return {
    rawText,
    filePath: '/workspace/load.mmt',
    baseName: 'load.mmt',
    docType: 'loadtest',
    inputsUsed: {},
  } as PreparedRun;
}

function makeOptions(): RunFileOptions {
  return {
    file: '',
    fileType: 'raw',
    filePath: '/workspace/load.mmt',
    manualInputs: {},
    envvar: {},
    manualEnvvars: {},
    fileLoader: async () => 'type: test\nsteps: []\n',
    jsRunner: async () => ({}),
    logger: () => {},
    reporter: () => {},
  };
}

describe('executeLoadTest', () => {
  it('requires repeat', async () => {
    const prepared = makePrepared(`type: loadtest\nthreads: 1\ntest: ./target.mmt\n`);
    const options = makeOptions();

    await expect(executeLoadTest(prepared, options, [], async () => ({
      js: '',
      result: {success: true, durationMs: 1, errors: []},
      identifier: 'target',
      displayName: 'target',
      docType: 'test',
      inputsUsed: {},
      envVarsUsed: {},
    }))).rejects.toThrow(/repeat/i);
  });

  it('runs numeric repeat as total iterations with thread concurrency', async () => {
    const prepared = makePrepared(`type: loadtest\nthreads: 4\nrepeat: 8\ntest: ./target.mmt\n`);
    const options = makeOptions();
    let calls = 0;
    let active = 0;
    let maxActive = 0;
    options.jsRunner = async () => {
      calls += 1;
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise(resolve => setTimeout(resolve, 5));
      active -= 1;
      return {};
    };

    const result = await executeLoadTest(prepared, options, [], async () => {
      throw new Error('runFile should not be called for optimized loadtest iterations');
    });

    expect(result.result.success).toBe(true);
    expect(calls).toBe(8);
    expect(maxActive).toBeGreaterThan(1);
  });

  it('adds load summary to auto exports', async () => {
    const prepared = makePrepared(`type: loadtest\nthreads: 2\nrepeat: 3\nrampup: 1ms\nexport:\n  - ./report.mmt\ntest: ./target.mmt\n`);
    const options = makeOptions();
    options.jsRunner = async () => ({});

    const result = await executeLoadTest(prepared, options, [], async () => {
      throw new Error('runFile should not be called for optimized loadtest iterations');
    });

    expect(result.suiteExports?.collectedResults.type).toBe('loadtest');
    expect(result.suiteExports?.collectedResults.load?.config?.threads).toBe(2);
    expect(result.suiteExports?.collectedResults.load?.summary?.iterations).toBe(3);
    expect(result.suiteExports?.collectedResults.load?.summary?.requests).toBe(3);
    expect(result.suiteExports?.collectedResults.load?.summary?.successes).toBe(3);
    expect(result.suiteExports?.collectedResults.load?.summary?.failures).toBe(0);
    expect(result.suiteExports?.collectedResults.load?.summary?.success_rate).toBe(1);
    expect(result.suiteExports?.collectedResults.load?.summary?.failed_rate).toBe(0);
  });

  it('counts failed iterations in load summary', async () => {
    const prepared = makePrepared(`type: loadtest\nthreads: 2\nrepeat: 4\nexport:\n  - ./report.mmt\ntest: ./target.mmt\n`);
    const options = makeOptions();
    let calls = 0;
    options.jsRunner = async (ctx: any) => {
      calls += 1;
      if (calls % 2 === 0) {
        ctx.logger('error', 'simulated iteration failure');
      }
      return {};
    };

    const result = await executeLoadTest(prepared, options, [], async () => {
      throw new Error('runFile should not be called for optimized loadtest iterations');
    });

    expect(result.result.success).toBe(false);
    expect(result.suiteExports?.collectedResults.load?.summary?.requests).toBe(4);
    expect(result.suiteExports?.collectedResults.load?.summary?.successes).toBe(2);
    expect(result.suiteExports?.collectedResults.load?.summary?.failures).toBe(2);
    expect(result.suiteExports?.collectedResults.load?.summary?.success_rate).toBe(0.5);
    expect(result.suiteExports?.collectedResults.load?.summary?.failed_rate).toBe(0.5);
  });

  it('passes resolved environment variables to child test runs', async () => {
    const prepared = makePrepared(`type: loadtest\nthreads: 1\nrepeat: 1\ntest: ./target.mmt\n`);
    prepared.envVarsUsed = {baseUrl: 'https://example.test'};
    const options = makeOptions();
    options.jsRunner = async () => ({});

    const result = await executeLoadTest(prepared, options, [], async () => {
      throw new Error('runFile should not be called for optimized loadtest iterations');
    });

    expect(result.envVarsUsed).toEqual({baseUrl: 'https://example.test'});
  });

  it('keeps iteration pass rate separate from traced HTTP request failures', async () => {
    const prepared = makePrepared(`type: loadtest\nthreads: 1\nrepeat: 2\nexport:\n  - ./report.mmt\ntest: ./target.mmt\n`);
    const options = makeOptions();
    options.jsRunner = async (ctx: any) => {
      ctx.logger('trace', 'Request: GET https://example.test/a');
      ctx.logger('trace', 'Response: 200 (10ms)');
      ctx.logger('trace', 'Request: GET https://example.test/b');
      ctx.logger('trace', 'Response: 500 (10ms)');
      ctx.logger('trace', 'Request: GET https://example.test/c');
      ctx.logger('trace', 'Response: -1 (10ms)');
      return {};
    };

    const result = await executeLoadTest(prepared, options, [], async () => {
      throw new Error('runFile should not be called for optimized loadtest iterations');
    });

    expect(result.suiteExports?.collectedResults.load?.summary?.iterations).toBe(2);
    expect(result.suiteExports?.collectedResults.load?.summary?.requests).toBe(6);
    expect(result.suiteExports?.collectedResults.load?.summary?.successes).toBe(2);
    expect(result.suiteExports?.collectedResults.load?.summary?.failures).toBe(0);
    expect(result.suiteExports?.collectedResults.load?.summary?.success_rate).toBe(1);
    expect(result.suiteExports?.collectedResults.load?.summary?.failed_rate).toBe(0);
    expect(result.suiteExports?.collectedResults.load?.http?.status_codes).toEqual({ '200': 2, '500': 2, '-1': 2 });
    expect(result.suiteExports?.collectedResults.load?.http?.failed_requests).toBe(4);
    expect(result.suiteExports?.collectedResults.load?.series?.length).toBeGreaterThan(0);
    const series = result.suiteExports?.collectedResults.load?.series || [];
    expect(series[series.length - 1]?.requests).toBe(6);
    expect(series[series.length - 1]?.errors).toBe(0);
    expect(series[series.length - 1]?.response_time).toBe(10);
  });

  it('prints compact load result instead of sampled check logs', async () => {
    const prepared = makePrepared(`type: loadtest\nthreads: 1\nrepeat: 1\ntest: ./target.mmt\n`);
    const logs: Array<{level: string; msg: string}> = [];
    const options = makeOptions();
    const seenCheckLogModes: any[] = [];
    options.logger = (level: any, msg: string) => {
      logs.push({level, msg});
    };
    options.jsRunner = async (ctx: any) => {
      seenCheckLogModes.push(ctx.checkLogMode);
      ctx.logger('info', '✓ Check "Health Check" - "status_field == ok" passed');
      ctx.logger('trace', 'Request: GET http://localhost:9099/health');
      ctx.logger('trace', 'Response: 200 (5ms)');
      return {};
    };

    const result = await executeLoadTest(prepared, options, [], async () => {
      throw new Error('runFile should not be called for optimized loadtest iterations');
    });

    expect(result.result.success).toBe(true);
    expect(seenCheckLogModes).toEqual(['none']);
    expect(logs.some(entry => entry.msg.includes('Check "Health Check"'))).toBe(false);
    expect(logs.some(entry => entry.msg.startsWith('Load summary:'))).toBe(false);
    expect(logs.some(entry => entry.msg.startsWith('Load result:'))).toBe(true);
  });

  it('prints load status every five seconds without printing per-check failures', async () => {
    let now = 1_000;
    const nowSpy = jest.spyOn(Date, 'now').mockImplementation(() => now);
    try {
      const prepared = makePrepared(`type: loadtest\nthreads: 1\nrepeat: 1\ntest: ./target.mmt\n`);
      const logs: Array<{level: string; msg: string}> = [];
      const options = makeOptions();
      options.logger = (level: any, msg: string) => {
        logs.push({level, msg});
      };
      options.jsRunner = async (ctx: any) => {
        now += 5_001;
        ctx.reporter({
          scope: 'test-step',
          runId: ctx.runId,
          stepIndex: 1,
          stepType: 'check',
          status: 'failed',
          title: 'Health Check',
          expects: [{comparison: 'status_field == ok', status: 'failed'}],
        });
        return {};
      };

      const result = await executeLoadTest(prepared, options, [], async () => {
        throw new Error('runFile should not be called for optimized loadtest iterations');
      });

      expect(result.result.success).toBe(false);
      expect(logs.some(entry => entry.msg.includes('Check "Health Check"'))).toBe(false);
      expect(logs.some(entry => entry.msg.startsWith('× Check'))).toBe(false);
      expect(logs.some(entry => entry.msg.startsWith('Load summary:'))).toBe(true);
      expect(logs.some(entry => entry.msg.startsWith('Load result: success=false'))).toBe(true);
    } finally {
      nowSpy.mockRestore();
    }
  });
});
