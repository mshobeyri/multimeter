jest.mock('./networkCoreNode', () => {
  const sentRequests: any[] = [];
  return {
    sentRequests,
    send: jest.fn(async (req: any) => {
      sentRequests.push(JSON.parse(JSON.stringify(req)));
      const body =
          typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
      // Mirror test.mmt.dev/echo wrapping: response.body.body = request body.
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

import {runFile} from './runner';
import {runJSCode} from './jsRunner';

const sentRequests =
    (require('./networkCoreNode') as any).sentRequests as any[];

describe('file-backed env values from type: api', () => {
  beforeEach(() => {
    sentRequests.length = 0;
  });

  const files: Record<string, string> = {
    '/tmp/live-api/env.mmt': [
      'type: env',
      'variables:',
      '  session: ./create_session_api.mmt',
    ].join('\n'),
    '/tmp/live-api/create_session_api.mmt': [
      'type: api',
      'outputs:',
      '  session: body.body.uuid',
      '  other: body.body.other',
      'cache: 1h',
      'url: https://example.test/echo',
      'method: post',
      'format: json',
      'body:',
      '  uuid: fixed-session-id',
      '  other: ignored',
    ].join('\n'),
    '/tmp/live-api/consumer_test.mmt': [
      'type: test',
      'steps:',
      '  - check: e:session == fixed-session-id',
    ].join('\n'),
    '/tmp/live-api/consumer_api.mmt': [
      'type: api',
      'url: https://example.test/echo',
      'method: post',
      'format: json',
      'body:',
      '  session: e:session',
    ].join('\n'),
  };

  const fileLoader = async (p: string) => files[p] ?? '';

  it('runs an API ./…mmt and uses the first YAML outputs key', async () => {
    const res = await runFile({
      fileType: 'path',
      file: '/tmp/live-api/consumer_test.mmt',
      filePath: '/tmp/live-api/consumer_test.mmt',
      fileLoader,
      jsRunner: runJSCode,
      logger: () => {},
      reporter: () => {},
      envvar: {session: './create_session_api.mmt'},
      envvarFilePath: '/tmp/live-api/env.mmt',
    } as any);
    expect(res.result.success).toBe(true);
    expect(sentRequests.length).toBeGreaterThanOrEqual(1);
  });

  it('resolves file-backed e: inside an API consumer body', async () => {
    const res = await runFile({
      fileType: 'path',
      file: '/tmp/live-api/consumer_api.mmt',
      filePath: '/tmp/live-api/consumer_api.mmt',
      fileLoader,
      jsRunner: runJSCode,
      logger: () => {},
      reporter: () => {},
      envvar: {session: './create_session_api.mmt'},
      envvarFilePath: '/tmp/live-api/env.mmt',
    } as any);
    expect(res.result.success).toBe(true);
    expect(sentRequests.length).toBe(2);
    const consumerBody = typeof sentRequests[1].body === 'string' ?
        JSON.parse(sentRequests[1].body) :
        sentRequests[1].body;
    expect(consumerBody.session).toBe('fixed-session-id');
  });
});
