import {
  clearTestCallCache_,
  getTestCallCache_,
  setTestCallCache_,
} from './testHelper';
import {runFile} from './runner';
import {runJSCode} from './jsRunner';
import {buildSuiteHierarchyFromSuiteFile} from './suiteHierarchy';
import {createSuiteBundle} from './suiteBundle';

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

const sessionTest = `type: test
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

const makeFileLoader = (files: Record<string, string>) =>
    async (requested: string) => {
      const key = String(requested).replace(/\\/g, '/');
      if (files[key] != null) {
        return files[key];
      }
      const name = key.split('/').pop() || '';
      const hit = Object.entries(files).find(([p]) => p.endsWith('/' + name));
      return hit ? hit[1] : '';
    };

const runSuiteBundle = async (params: {
  files: Record<string, string>;
  suitePath: string;
  events?: any[];
}) => {
  const {files, suitePath, events} = params;
  const fileLoader = makeFileLoader(files);
  const tree = await buildSuiteHierarchyFromSuiteFile({
    suiteFilePath: suitePath,
    suiteRawText: files[suitePath],
    fileLoader,
  });
  const bundle = createSuiteBundle({
    rootSuitePath: suitePath,
    hierarchy: tree,
  });
  return runFile({
    file: files[suitePath],
    filePath: suitePath,
    fileType: 'raw',
    fileLoader,
    suiteBundle: bundle,
    jsRunner: (context: any) => runJSCode(context),
    logger: () => undefined,
    reporter: events ? ((event: any) => events.push(event)) : undefined,
  } as any);
};

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
      '/project/session.mmt': sessionTest,
      '/project/parent.mmt': parent,
    };
    const events: any[] = [];

    const result = await runFile({
      file: parent,
      filePath: '/project/parent.mmt',
      fileType: 'raw',
      fileLoader: makeFileLoader(files),
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

  it('clears cache between separate top-level test runs', async () => {
    const parent = `type: test
title: Use cached session once
import:
  session: ./session.mmt
steps:
  - call: session
    id: only
    inputs:
      user: alice
      pass: secret
    expect:
      token: != null
`;
    const files: Record<string, string> = {
      '/project/login.mmt': loginApi,
      '/project/session.mmt': sessionTest,
      '/project/parent.mmt': parent,
    };
    const fileLoader = makeFileLoader(files);
    const runOnce = () => runFile({
      file: parent,
      filePath: '/project/parent.mmt',
      fileType: 'raw',
      fileLoader,
      jsRunner: (context: any) => runJSCode(context),
      logger: () => undefined,
    } as any);

    const first = await runOnce();
    expect(first.result?.success).toBe(true);
    expect(sentRequests).toHaveLength(1);
    expect(getTestCallCache_('Create session', {user: 'alice', pass: 'secret'}))
        .toBeUndefined();

    const second = await runOnce();
    expect(second.result?.success).toBe(true);
    // Fresh top-level run must miss and hit the network again.
    expect(sentRequests).toHaveLength(2);
  });
});

describe('test call cache across suite hierarchy', () => {
  beforeEach(() => {
    sentRequests.length = 0;
    clearTestCallCache_();
  });

  it('shares cache across suite sibling tests that call the same session', async () => {
    const callerA = `type: test
title: Caller A
import:
  session: ./session.mmt
steps:
  - call: session
    id: auth
    report: all
    inputs:
      user: alice
      pass: secret
    expect:
      token: != null
`;
    const callerB = `type: test
title: Caller B
import:
  session: ./session.mmt
steps:
  - call: session
    id: auth
    report: all
    inputs:
      user: alice
      pass: secret
    expect:
      token: != null
`;
    const suite = `type: suite
title: Cache suite
items:
  - ./caller_a.mmt
  - then
  - ./caller_b.mmt
`;
    const files: Record<string, string> = {
      '/project/login.mmt': loginApi,
      '/project/session.mmt': sessionTest,
      '/project/caller_a.mmt': callerA,
      '/project/caller_b.mmt': callerB,
      '/project/suite.mmt': suite,
    };
    const events: any[] = [];
    const result = await runSuiteBundle({
      files,
      suitePath: '/project/suite.mmt',
      events,
    });

    expect(result.result?.success).toBe(true);
    // First sibling populates; second sibling must reuse (1 HTTP total).
    expect(sentRequests).toHaveLength(1);

    const cachedSteps =
        events.filter(e => e.scope === 'test-step' && e.cached === true);
    expect(cachedSteps.length).toBeGreaterThanOrEqual(1);
  });

  it('shares cache across nested suite-of-suites', async () => {
    const caller = `type: test
title: Nested caller
import:
  session: ./session.mmt
steps:
  - call: session
    id: auth
    inputs:
      user: alice
      pass: secret
    expect:
      token: != null
`;
    const files: Record<string, string> = {
      '/project/login.mmt': loginApi,
      '/project/session.mmt': sessionTest,
      '/project/caller.mmt': caller,
      '/project/child_suite.mmt': `type: suite
title: Child suite
items:
  - ./caller.mmt
`,
      '/project/root_suite.mmt': `type: suite
title: Root suite
items:
  - ./caller.mmt
  - then
  - ./child_suite.mmt
`,
    };
    const result = await runSuiteBundle({
      files,
      suitePath: '/project/root_suite.mmt',
    });

    expect(result.result?.success).toBe(true);
    // Root suite item + nested suite item share one cache entry.
    expect(sentRequests).toHaveLength(1);
  });

  it('suite item that runs cached test as root seeds later callers', async () => {
    const consumer = `type: test
title: Consume session
import:
  session: ./session.mmt
steps:
  - call: session
    id: auth
    report: all
    inputs:
      user: alice
      pass: secret
    expect:
      token: != null
`;
    const suite = `type: suite
title: Seed then consume
items:
  - ./session.mmt
  - then
  - ./consumer.mmt
`;
    const files: Record<string, string> = {
      '/project/login.mmt': loginApi,
      '/project/session.mmt': sessionTest,
      '/project/consumer.mmt': consumer,
      '/project/suite.mmt': suite,
    };
    const events: any[] = [];
    const result = await runSuiteBundle({
      files,
      suitePath: '/project/suite.mmt',
      events,
    });

    expect(result.result?.success).toBe(true);
    // Root run of session executes once; consumer call hits cache.
    expect(sentRequests).toHaveLength(1);
    const cachedSteps =
        events.filter(e => e.scope === 'test-step' && e.cached === true);
    expect(cachedSteps.length).toBeGreaterThanOrEqual(1);
  });

  it('respects TTL expiry across suite siblings', async () => {
    const shortCacheSession = `type: test
title: Create session
import:
  login: ./login.mmt
inputs:
  user: alice
  pass: secret
outputs:
  token: ''
  user: ''
cache: 1ms
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
    const caller = `type: test
title: Caller
import:
  session: ./session.mmt
steps:
  - call: session
    id: auth
    inputs:
      user: alice
      pass: secret
    expect:
      token: != null
`;
    const suite = `type: suite
title: Expiry suite
items:
  - ./caller_a.mmt
  - then
  - ./caller_b.mmt
`;
    const files: Record<string, string> = {
      '/project/login.mmt': loginApi,
      '/project/session.mmt': shortCacheSession,
      '/project/caller_a.mmt': caller,
      '/project/caller_b.mmt': caller,
      '/project/suite.mmt': suite,
    };

    const originalNow = Date.now;
    let fakeNow = originalNow();
    const nowSpy = jest.spyOn(Date, 'now').mockImplementation(() => fakeNow);

    try {
      const fileLoader = makeFileLoader(files);
      const tree = await buildSuiteHierarchyFromSuiteFile({
        suiteFilePath: '/project/suite.mmt',
        suiteRawText: files['/project/suite.mmt'],
        fileLoader,
      });
      const bundle = createSuiteBundle({
        rootSuitePath: '/project/suite.mmt',
        hierarchy: tree,
      });

      // Advance time between siblings so the 1ms entry expires.
      let childIndex = 0;
      const result = await runFile({
        file: files['/project/suite.mmt'],
        filePath: '/project/suite.mmt',
        fileType: 'raw',
        fileLoader,
        suiteBundle: bundle,
        jsRunner: async (context: any) => {
          if (childIndex > 0) {
            fakeNow += 50;
          }
          childIndex += 1;
          return runJSCode(context);
        },
        logger: () => undefined,
      } as any);

      expect(result.result?.success).toBe(true);
      expect(sentRequests).toHaveLength(2);
    } finally {
      nowSpy.mockRestore();
    }
  });

  it('clears cache when a suite run finishes so the next suite starts fresh',
     async () => {
       const caller = `type: test
title: Caller
import:
  session: ./session.mmt
steps:
  - call: session
    id: auth
    inputs:
      user: alice
      pass: secret
    expect:
      token: != null
`;
       const suite = `type: suite
title: One caller
items:
  - ./caller.mmt
`;
       const files: Record<string, string> = {
         '/project/login.mmt': loginApi,
         '/project/session.mmt': sessionTest,
         '/project/caller.mmt': caller,
         '/project/suite.mmt': suite,
       };

       const first = await runSuiteBundle({
         files,
         suitePath: '/project/suite.mmt',
       });
       expect(first.result?.success).toBe(true);
       expect(sentRequests).toHaveLength(1);
       expect(getTestCallCache_(
                  'Create session', {user: 'alice', pass: 'secret'}))
           .toBeUndefined();

       const second = await runSuiteBundle({
         files,
         suitePath: '/project/suite.mmt',
       });
       expect(second.result?.success).toBe(true);
       expect(sentRequests).toHaveLength(2);
     });
});
