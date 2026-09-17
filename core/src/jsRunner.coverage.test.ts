import {runJSCode} from './jsRunner';
import {
  AssertionFailedError,
  beginServerSession_,
  endServerSession_,
  isServerRunning_,
  stopAllServers_,
  TestAbortError,
} from './testHelper';

jest.mock('./networkCoreNode', () => ({
  send: jest.fn(async (req: any) => {
    if (req?.url === 'fail') {
      throw new Error('send failed');
    }
    return {
      status: 200,
      statusText: 'OK',
      body: '{"ok":true}',
      headers: {'content-type': 'application/json'},
      duration: 12,
    };
  }),
  setRunnerNetworkConfig: jest.fn(),
  getRunnerNetworkConfig: jest.fn(() => ({})),
}));

jest.mock('./grpcCore', () => ({
  sendGrpcRequest: jest.fn(async () => ({
    body: '{"n":1}',
    metadata: {m: '1'},
    status: 200,
    statusText: 'OK',
    duration: 7,
  })),
}));

describe('jsRunner extra runtime paths', () => {
  const logger = jest.fn();

  afterEach(() => {
    logger.mockReset();
    stopAllServers_();
  });

  it('routes console levels and marks console.error as failure', async () => {
    await runJSCode({
      js: `
        console.trace({t: 1});
        console.debug('d');
        console.log('l');
        console.warn('w');
        console.error('e');
      `,
      title: 'console',
      runId: 'r1',
      logger,
      id: 'leaf-1',
    });
    const levels = logger.mock.calls.map((c) => c[0]);
    expect(levels).toEqual(expect.arrayContaining(['trace', 'debug', 'info', 'warn', 'error']));
    expect(logger.mock.calls.some((c) => c[0] === 'error' && String(c[1]).includes('failed'))).toBe(true);
  });

  it('exposes random/current/access/extract and unknown tokens', async () => {
    const result = await runJSCode({
      js: `
        return {
          rnd: __mmt_random('uuid'),
          bounded: __mmt_random('int(7,7)'),
          sized: __mmt_random('string(9)'),
          missingR: __mmt_random('no-such'),
          cur: __mmt_current('year'),
          shifted: __mmt_current('epoch(+1h)'),
          missingC: __mmt_current('no-such'),
          access: __mmt_access({a: {b: 2}}, '.a.b'),
          extracted: extractOutputs_({
            type: 'json',
            body: '{"x":1}',
            headers: {},
            cookies: {},
          }, {x: 'body.x'}),
        };
      `,
      title: 'helpers',
      runId: 'r2',
      logger,
    });
    expect(typeof result.rnd).toBe('string');
    expect(result.bounded).toBe(7);
    expect(result.sized).toMatch(/^[A-Za-z]{9}$/);
    expect(result.missingR).toBe('r:no-such');
    expect(typeof result.cur).toBe('number');
    expect(result.shifted).toBeGreaterThan(
        Math.floor(Date.now() / 1000) + 3500);
    expect(result.missingC).toBe('c:no-such');
    expect(result.access).toBe(2);
    expect(result.extracted.x).toBe(1);
  });

  it('traces send_ success and error and records grpc duration', async () => {
    const send = await runJSCode({
      js: `return send_({ url: 'https://example.com', method: 'GET' });`,
      title: 'trace-ok',
      runId: 'r3',
      logger,
      traceSend: true,
      runKind: 'API',
    });
    expect(send.status).toBe(200);
    await expect(runJSCode({
      js: `return send_({ url: 'fail' });`,
      title: 'trace-err',
      runId: 'r4',
      logger,
      traceSend: true,
    })).rejects.toThrow('send failed');

    const grpc = await runJSCode({
      js: `return sendGrpc_({ url: 'grpc://h:1', service: 'S', method: 'M' });`,
      title: 'grpc',
      runId: 'r5',
      logger,
      runKind: 'API',
    });
    expect(grpc.status).toBe(200);
  });

  it('reads binary files and fails when loader is missing', async () => {
    const buf = await runJSCode({
      js: `return readBinaryFile_('a.bin');`,
      title: 'bin',
      runId: 'r6',
      logger,
      binaryFileLoader: async () => Buffer.from('hi'),
    });
    expect(Buffer.isBuffer(buf)).toBe(true);
    await expect(runJSCode({
      js: `return readBinaryFile_('a.bin');`,
      title: 'bin-missing',
      runId: 'r7',
      logger,
    })).rejects.toThrow('Binary file loader not available');
  });

  it('aborts via checkAbort_ and rethrows assertion failures', async () => {
    const ac = new AbortController();
    ac.abort();
    await expect(runJSCode({
      js: `checkAbort_();`,
      title: 'abort',
      runId: 'r8',
      logger,
      abortSignal: ac.signal,
    })).rejects.toBeInstanceOf(TestAbortError);

    await expect(runJSCode({
      js: `throw new mmtHelper.AssertionFailedError('nope');`,
      title: 'assert',
      runId: 'r9',
      logger,
    })).rejects.toBeInstanceOf(AssertionFailedError);
  });

  it('stops run: servers when the test is the outermost session', async () => {
    let stops = 0;
    await runJSCode({
      js: `return startServer_('mock');`,
      title: 'run server',
      runId: 'r-server-outer',
      logger,
      serverRunner: async () => () => {
        stops += 1;
      },
    });
    expect(isServerRunning_('mock')).toBe(false);
    expect(stops).toBe(1);
  });

  it('keeps run: servers when a parent session is already open', async () => {
    let stops = 0;
    beginServerSession_();
    await runJSCode({
      js: `return startServer_('mock');`,
      title: 'run server nested',
      runId: 'r-server-nested',
      logger,
      serverRunner: async () => () => {
        stops += 1;
      },
    });
    expect(isServerRunning_('mock')).toBe(true);
    expect(stops).toBe(0);
    endServerSession_();
    expect(isServerRunning_('mock')).toBe(false);
    expect(stops).toBe(1);
  });

  it('marks reporter failures without throwing and evicts compiled cache', async () => {
    const events: any[] = [];
    await runJSCode({
      js: `
        __reporter({ status: 'failed' });
        __reporter({ result: 'failed' });
        __reporter({ expects: [{ status: 'failed' }] });
        __reporter({});
      `,
      title: 'rep',
      runId: 'r10',
      logger,
      reporter: (e) => events.push(e),
      checkLogMode: 'none',
    });
    expect(events.length).toBe(4);

    for (let i = 0; i < 66; i++) {
      await runJSCode({
        js: `return ${i};`,
        title: `cache-${i}`,
        runId: `c${i}`,
        logger,
      });
    }
  });
});
