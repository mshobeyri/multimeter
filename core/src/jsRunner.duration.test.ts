import {runJSCode} from './jsRunner';

jest.mock('./networkCoreNode', () => ({
  send: jest.fn(async () => ({
    status: 200,
    statusText: 'OK',
    body: '{"ok":true}',
    headers: {'content-type': 'application/json'},
    duration: 42,
  })),
  setRunnerNetworkConfig: jest.fn(),
  getRunnerNetworkConfig: jest.fn(() => ({})),
}));

describe('jsRunner API finish duration', () => {
  it('logs network send/receive duration for API runs', async () => {
    const logs: Array<{level: string; message: string}> = [];
    await runJSCode({
      js: `
        return (async () => {
          const res = await send_({ url: 'https://example.com', method: 'GET' });
          return { status: res.status, _: { duration: res.duration } };
        })();
      `,
      title: 'Sample API',
      runId: 'api-duration-test',
      logger: (level, message) => {
        logs.push({level, message});
      },
      runKind: 'API',
    });

    expect(logs.some(l =>
        l.level === 'info' &&
        l.message === 'API "Sample API" finished in 42 ms successfully')).toBe(true);
  });

  it('keeps wall-clock duration for Test runs', async () => {
    const logs: Array<{level: string; message: string}> = [];
    await runJSCode({
      js: `
        return (async () => {
          await send_({ url: 'https://example.com', method: 'GET' });
          await new Promise(r => setTimeout(r, 30));
        })();
      `,
      title: 'Sample Test',
      runId: 'test-duration-test',
      logger: (level, message) => {
        logs.push({level, message});
      },
      runKind: 'Test',
    });

    const finish = logs.find(l =>
        l.level === 'info' && l.message.includes('finished in'));
    expect(finish).toBeDefined();
    const match = finish!.message.match(/finished in (\d+) ms/);
    expect(match).toBeTruthy();
    // Wall-clock includes the 30ms delay, so it should be clearly above network-only 42ms.
    expect(Number(match![1])).toBeGreaterThanOrEqual(30);
  });
});
