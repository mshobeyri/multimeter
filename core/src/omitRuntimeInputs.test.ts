import {runFile} from './runner';
import {runJSCode} from './jsRunner';

jest.mock('./networkCoreNode', () => {
  const sentRequests: any[] = [];
  return {
    sentRequests,
    send: jest.fn(async (req: any) => {
      sentRequests.push(JSON.parse(JSON.stringify(req)));
      return {
        status: 200,
        statusText: 'OK',
        body: JSON.stringify({echoed: 'yes'}),
        headers: {'content-type': 'application/json'},
        duration: 7,
      };
    }),
    setRunnerNetworkConfig: jest.fn(),
    getRunnerNetworkConfig: jest.fn(() => ({})),
  };
});

const sentRequests =
    (require('./networkCoreNode') as any).sentRequests as any[];

const ECHO_API = `type: api
url: https://example.com/echo
method: post
inputs:
  message: hello
headers:
  X-Message: i:message
body:
  message: i:message
  keep: always
outputs:
  echoed: body.echoed
  missing: body.nothingHere
`;

const ECHO_TEST = `type: test
title: Data driven echo test
import:
  echo: ./echo_api.mmt
steps:
  - call: echo
    id: result
    title: msg
    inputs:
      message: omit
    expect:
      status: =~ "200"
`;

async function runEchoTest() {
  const files: Record<string, string> = {
    'echo_api.mmt': ECHO_API,
    'echo_test.mmt': ECHO_TEST,
  };
  const events: any[] = [];
  const result = await runFile({
    file: ECHO_TEST,
    filePath: '/project/echo_test.mmt',
    fileType: 'raw',
    fileLoader: async (requested: string) => {
      const name = String(requested).split('/').pop() || '';
      return files[name] ?? '';
    },
    jsRunner: (context: any) => runJSCode(context),
    logger: () => undefined,
    reporter: (event: any) => events.push(event),
  } as any);
  return {result, events};
}

describe('omit passed as a call-time input', () => {
  beforeEach(() => {
    sentRequests.length = 0;
  });

  it('removes the field instead of sending the omit marker', async () => {
    const {result} = await runEchoTest();

    expect(result.result.success).toBe(true);
    expect(sentRequests).toHaveLength(1);
    const sent = sentRequests[0];
    expect(JSON.stringify(sent)).not.toContain('__MMT_OMIT__');
    expect(JSON.parse(sent.body)).toEqual({keep: 'always'});
    expect(sent.headers).not.toHaveProperty('X-Message');
  });

  it('reports a missing output as omit, not the internal marker', async () => {
    const {events} = await runEchoTest();

    const details = events
        .filter(event => event && event.scope === 'test-step' &&
                typeof event.details === 'string')
        .map(event => event.details as string);
    expect(details.length).toBeGreaterThan(0);
    expect(details.some(text => text.includes('__MMT_OMIT__'))).toBe(false);
    expect(details.some(text => text.includes('"missing": "omit"') ||
                                text.includes('"missing":"omit"')))
        .toBe(true);
  });
});
