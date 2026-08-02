import {
  clearTestCallCache_,
  getTestCallCache_,
  setTestCallCache_,
} from './testHelper';
import {runFile} from './runner';
import {runJSCode} from './jsRunner';

jest.mock('./networkCoreNode', () => {
  const sentRequests: any[] = [];
  return {
    sentRequests,
    send: jest.fn(async (req: any) => {
      sentRequests.push(JSON.parse(JSON.stringify(req)));
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
      return {
        status: 200,
        statusText: 'OK',
        body: {
          body: {
            user: body.user || 'x',
            token: `${body.user || 'x'}-session-token`,
          },
        },
        headers: {'content-type': 'application/json'},
        duration: 3,
      };
    }),
    setRunnerNetworkConfig: jest.fn(),
    getRunnerNetworkConfig: jest.fn(() => ({})),
  };
});

const sentRequests =
    (require('./networkCoreNode') as any).sentRequests as any[];

describe('test call cache helpers', () => {
  beforeEach(() => {
    clearTestCallCache_();
  });

  it('stores and returns clones marked with _.cached', () => {
    setTestCallCache_(
        'Create session', {user: 'alice'}, {token: 't1', _: {status: 200}},
        Date.now() + 60_000);
    const hit = getTestCallCache_('Create session', {user: 'alice'});
    expect(hit).toEqual({token: 't1', _: {status: 200, cached: true}});
    expect(getTestCallCache_('Create session', {user: 'bob'})).toBeUndefined();
  });

  it('expires entries', () => {
    setTestCallCache_(
        'Create session', {user: 'alice'}, {token: 't1'}, Date.now() - 1);
    expect(getTestCallCache_('Create session', {user: 'alice'})).toBeUndefined();
  });
});

describe('test call cache end-to-end', () => {
  beforeEach(() => {
    sentRequests.length = 0;
    clearTestCallCache_();
  });

  it('second identical call skips HTTP and reports cached', async () => {
    const loginApi = `type: api
title: Login echo
inputs:
  username: alice
  password: secret
outputs:
  token: body.body.token
  user: body.body.user
url: https://test.mmt.dev/echo
method: post
format: json
body:
  user: i:username
  token: <<i:username>>-session-token
`;

    const session = `type: test
title: Create session
import:
  login: ./login.mmt
inputs:
  user: alice
  pass: secret
outputs:
  token: ''
  user: ''
cache: 5m
steps:
  - call: login
    id: auth
    inputs:
      username: i:user
      password: i:pass
    expect:
      status: =~ "200"
  - js: |
      outputs.token = auth.token
      outputs.user = auth.user
`;

    const parent = `type: test
title: Use cached session
import:
  session: ./session.mmt
steps:
  - call: session
    id: first
    inputs:
      user: alice
      pass: secret
    expect:
      token: != null
  - call: session
    id: second
    inputs:
      user: alice
      pass: secret
    expect:
      token: == \${first.token}
  - call: session
    id: third
    inputs:
      user: bob
      pass: other
    expect:
      user: == bob
`;

    const files: Record<string, string> = {
      '/project/login.mmt': loginApi,
      '/project/session.mmt': session,
      '/project/parent.mmt': parent,
    };
    const events: any[] = [];

    const result = await runFile({
      file: parent,
      filePath: '/project/parent.mmt',
      fileType: 'raw',
      fileLoader: async (requested: string) => {
        const key = String(requested).replace(/\\/g, '/');
        if (files[key] != null) {
          return files[key];
        }
        const name = key.split('/').pop() || '';
        const hit = Object.entries(files).find(([p]) => p.endsWith('/' + name));
        return hit ? hit[1] : '';
      },
      jsRunner: (context: any) => runJSCode(context),
      logger: () => undefined,
      reporter: (event: any) => events.push(event),
    } as any);

    if (!result.result?.success) {
      const js = result.js || '';
      const i = js.indexOf('getTestCallCache_');
      console.log(js.slice(Math.max(0, i - 200), i + 900));
      console.log('errors', result.result?.errors);
      console.log('logs', result.result?.logs?.slice(-20));
    }
    expect(result.result?.success).toBe(true);
    // first alice + third bob → 2 HTTP; second alice served from cache
    expect(sentRequests).toHaveLength(2);

    const stepEvents = events.filter(e => e.scope === 'test-step');
    const cachedSteps = stepEvents.filter(e => e.cached === true);
    expect(cachedSteps.length).toBeGreaterThanOrEqual(1);
  });
});
