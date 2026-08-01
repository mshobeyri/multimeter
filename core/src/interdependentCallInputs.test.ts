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
        body: {ok: true},
        headers: {'content-type': 'application/json'},
        duration: 5,
      };
    }),
    setRunnerNetworkConfig: jest.fn(),
    getRunnerNetworkConfig: jest.fn(() => ({})),
  };
});

const sentRequests =
    (require('./networkCoreNode') as any).sentRequests as any[];

const ECHO_API = `type: api
title: Echo API
description: Posts a message and echoes it back
inputs:
  message: hello world
  xx: asd_<<i:message>>
url: https://test.mmt.dev/echo
method: post
format: json
body:
  xxx: i:xx
`;

const GREET_API = `type: api
title: Greet API
inputs:
  name: world
url: https://test.mmt.dev/echo
method: post
format: json
body:
  hello: i:name
`;

const IMPORT_TEST = `type: test
title: Test calling imported APIs
description: |-
  Imports two APIs using relative paths and calls each one.
  Shows same-directory and subfolder relative imports.
import:
  echo: ../apis/echo_api.mmt
  greet: +/apis/greet_api.mmt
inputs:
  message: hello imports
  name: multimeter
  ddd: <<i:name>>_<<e:base_url>>
steps:
  - call: echo
    id: echoResult
    title: Call echo API (relative import from parent dir)
    inputs:
      message: i:ddd
    expect:
      status: =~ "200"
`;

describe('interdependent inputs across test call → API defaults', () => {
  beforeEach(() => {
    sentRequests.length = 0;
  });

  it('resolves test ddd and API xx: asd_<<i:message>> into the request body', async () => {
    const files: Record<string, string> = {
      '/project/apis/echo_api.mmt': ECHO_API,
      '/project/apis/greet_api.mmt': GREET_API,
      '/project/tests/import_test.mmt': IMPORT_TEST,
    };

    const result = await runFile({
      file: IMPORT_TEST,
      filePath: '/project/tests/import_test.mmt',
      fileType: 'raw',
      envvar: {base_url: 'https://test.mmt.dev'},
      projectRoot: '/project',
      fileLoader: async (requested: string) => {
        const key = String(requested).replace(/\\/g, '/');
        if (files[key] != null) {
          return files[key];
        }
        const name = key.split('/').pop() || '';
        const byName = Object.entries(files).find(([p]) => p.endsWith('/' + name));
        return byName ? byName[1] : '';
      },
      jsRunner: (context: any) => runJSCode(context),
      logger: () => undefined,
    } as any);

    expect(result.result?.success).toBe(true);
    expect(sentRequests).toHaveLength(1);

    const body = sentRequests[0].body;
    const parsed = typeof body === 'string' ? JSON.parse(body) : body;
    expect(parsed).toEqual({
      xxx: 'asd_multimeter_https://test.mmt.dev',
    });
  });

  it('keeps literal <<i:message>> out of the wire body when only message is overridden', async () => {
    const files: Record<string, string> = {
      '/project/echo_api.mmt': ECHO_API,
      '/project/call.mmt': `type: test
import:
  echo: ./echo_api.mmt
steps:
  - call: echo
    inputs:
      message: forced-value
`,
    };

    await runFile({
      file: files['/project/call.mmt'],
      filePath: '/project/call.mmt',
      fileType: 'raw',
      fileLoader: async (requested: string) => {
        const key = String(requested).replace(/\\/g, '/');
        if (files[key] != null) {
          return files[key];
        }
        const name = key.split('/').pop() || '';
        return name === 'echo_api.mmt' ? ECHO_API : '';
      },
      jsRunner: (context: any) => runJSCode(context),
      logger: () => undefined,
    } as any);

    expect(sentRequests).toHaveLength(1);
    const body = sentRequests[0].body;
    const parsed = typeof body === 'string' ? JSON.parse(body) : body;
    expect(parsed).toEqual({xxx: 'asd_forced-value'});
    expect(JSON.stringify(parsed)).not.toContain('<<i:');
  });
});
