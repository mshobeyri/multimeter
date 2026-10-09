jest.mock('./networkCoreNode', () => {
  const sentRequests: any[] = [];
  return {
    sentRequests,
    send: jest.fn(async (req: any) => {
      sentRequests.push(req);
      // Slow network so overlapping reads can race the resolving flag.
      await new Promise(r => setTimeout(r, 30));
      const body =
          typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
      return {
        status: 200,
        statusText: 'OK',
        body: {body},
        headers: {'content-type': 'application/json'},
        duration: 2,
      };
    }),
    setRunnerNetworkConfig: jest.fn(),
    getRunnerNetworkConfig: jest.fn(() => ({})),
  };
});

import {createEnvStore} from './envStore';
import {runFile} from './runner';
import {runJSCode} from './jsRunner';

describe('concurrent file-backed env reads', () => {
  it('sequential e:session_test then e:session_api both resolve', async () => {
    const files: Record<string, string> = {
      '/tmp/c/env.mmt': [
        'type: env',
        'variables:',
        '  session_api: ./api.mmt',
        '  session_test: ./test.mmt',
      ].join('\n'),
      '/tmp/c/api.mmt': [
        'type: api',
        'outputs:',
        '  session: body.body.uuid',
        'url: https://example.test/echo',
        'method: post',
        'format: json',
        'body:',
        '  uuid: from-api',
      ].join('\n'),
      '/tmp/c/test.mmt': [
        'type: test',
        'outputs:',
        '  session: x',
        'cache: 1h',
        'steps:',
        '  - set:',
        '      o:session: from-test',
      ].join('\n'),
      '/tmp/c/consumer.mmt': [
        'type: test',
        'steps:',
        '  - check: e:session_test == from-test',
        '  - check: e:session_api == from-api',
      ].join('\n'),
    };
    const res = await runFile({
      fileType: 'path',
      file: '/tmp/c/consumer.mmt',
      filePath: '/tmp/c/consumer.mmt',
      fileLoader: async (p: string) => files[p] ?? '',
      jsRunner: runJSCode,
      logger: () => {},
      reporter: () => {},
      envvar: {
        session_api: './api.mmt',
        session_test: './test.mmt',
      },
      envvarFilePath: '/tmp/c/env.mmt',
    } as any);
    expect(res.result.success).toBe(true);
  });

  it('concurrent reads of the same getter share one run (no null)', async () => {
    const store = createEnvStore({session: './api.mmt'});
    let runs = 0;
    store.runEnvFile = async () => {
      runs += 1;
      await new Promise(r => setTimeout(r, 40));
      return {outputs: {session: 'ok'}, outputKeys: ['session'], cache: '1h'};
    };
    const getter = store.values.session as () => Promise<any>;
    const [a, b] = await Promise.all([getter(), getter()]);
    expect(a).toBe('ok');
    expect(b).toBe('ok');
    expect(runs).toBe(1);
  });

});
