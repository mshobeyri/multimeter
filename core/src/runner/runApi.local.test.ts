/**
 * request → response through real core `runFile` + in-process local.mmt.dev
 * (no sockets / internet). Complements apiTesterFlow.integration.test.ts.
 */
import * as http from 'http';

import {DEFAULT_NETWORK_CONFIG} from '../data/NetworkData';
import {
  onLocalTestServerRequest,
} from '../network/localTestServer';
import {
  closeAllHttpConnections,
  setRunnerNetworkConfig,
} from '../network/networkCore';
import {buildApiTesterResponse} from './apiRunResult';
import {runJSCode} from './jsRunner';
import {runFile} from './runner';

const BASE = 'https://local.mmt.dev';

type RunLocalOpts = {
  envvar?: Record<string, any>;
  requestOverride?: Record<string, unknown>|null;
  reporter?: (msg: any) => void;
};

async function runLocalApi(yaml: string, opts: RunLocalOpts = {}) {
  return runFile({
    file: yaml,
    fileType: 'raw',
    filePath: '/tmp/local-api.mmt',
    fileLoader: async () => '',
    envvar: opts.envvar || {},
    jsRunner: (ctx: any) => runJSCode({
      ...ctx,
      requestOverride: opts.requestOverride ?? null,
    }),
    logger: () => undefined,
    reporter: opts.reporter,
  } as any);
}

describe('runFile + local.mmt.dev (request → response)', () => {
  beforeEach(() => {
    setRunnerNetworkConfig(DEFAULT_NETWORK_CONFIG);
  });

  afterEach(() => {
    closeAllHttpConnections();
  });

  it('happy glyph path: GET echo fills outputs._', async () => {
    const yaml = [
      'type: api',
      'title: Local echo',
      `url: ${BASE}/echo`,
      'method: get',
      'query:',
      '  q: hello',
      '',
    ].join('\n');

    const outcome = await runLocalApi(yaml);
    expect(outcome.docType).toBe('api');
    expect(outcome.result.success).toBe(true);
    expect(outcome.result.outputs?._?.status).toBe(200);
    expect(outcome.result.outputs?._?.duration).toBeGreaterThanOrEqual(0);

    const body = typeof outcome.result.outputs?._?.body === 'string' ?
        JSON.parse(outcome.result.outputs._.body) :
        outcome.result.outputs?._?.body;
    expect(body.path).toBe('/echo');
    expect(body.query).toEqual({q: 'hello'});
  });

  it('requestOverride sends the minted snapshot (no r: remint)', async () => {
    const yaml = [
      'type: api',
      'title: Override',
      `url: ${BASE}/echo/<<r:uuid>>`,
      'method: post',
      'format: json',
      'headers:',
      '  X-Id: r:uuid',
      'body:',
      '  id: r:uuid',
      '',
    ].join('\n');

    const fixedId = '11111111-2222-3333-4444-555555555555';
    const override = {
      url: `${BASE}/echo/${fixedId}`,
      protocol: 'http',
      method: 'post',
      headers: {
        'Content-Type': 'application/json',
        'X-Id': fixedId,
      },
      body: JSON.stringify({id: fixedId}),
    };

    const wire: Array<{path: string; headers: Record<string, string>; body: string}> =
        [];
    const stop = onLocalTestServerRequest((info) => {
      if (info.path.startsWith('/echo')) {
        wire.push({path: info.path, headers: info.headers, body: info.body});
      }
    });

    try {
      const outcome = await runLocalApi(yaml, {requestOverride: override});
      expect(outcome.result.success).toBe(true);
      expect(wire).toHaveLength(1);
      expect(wire[0].path).toBe(`/echo/${fixedId}`);
      expect(wire[0].headers['x-id']).toBe(fixedId);
      expect(JSON.parse(wire[0].body)).toEqual({id: fixedId});

      const echoed = typeof outcome.result.outputs?._?.body === 'string' ?
          JSON.parse(outcome.result.outputs._.body) :
          outcome.result.outputs?._?.body;
      expect(echoed.path).toBe(`/echo/${fixedId}`);
      expect(echoed.body).toEqual({id: fixedId});
    } finally {
      stop();
    }
  });

  it('oauth2 client_credentials uses local /token then Bearer tok-local',
     async () => {
       const yaml = [
         'type: api',
         'title: OAuth',
         `url: ${BASE}/echo`,
         'method: get',
         'auth:',
         '  type: oauth2',
         '  grant: client_credentials',
         '  token_url: <<e:token_url>>',
         '  client_id: cid',
         '  client_secret: secret',
         '',
       ].join('\n');

       const hits: string[] = [];
       const stop = onLocalTestServerRequest((info) => {
         hits.push(info.path.replace(/\/+$/, '') || '/');
       });

       try {
         const outcome = await runLocalApi(yaml, {
           envvar: {token_url: `${BASE}/token`},
         });
         expect(outcome.result.success).toBe(true);
         expect(hits).toContain('/token');
         expect(hits).toContain('/echo');

         const details = JSON.parse(String(outcome.result.outputs?._?.details));
         const auth = details?.request?.headers?.Authorization ||
             details?.request?.headers?.authorization;
         expect(auth).toBe('Bearer tok-local');
       } finally {
         stop();
       }
     });

  it('HTTP 404 still shapes Response panel outputs', async () => {
    const yaml = [
      'type: api',
      'title: Not found',
      `url: ${BASE}/status/404`,
      'method: get',
      '',
    ].join('\n');

    const outcome = await runLocalApi(yaml);
    // Network succeeded; HTTP 404 is a normal response (run fails only on status < 0).
    expect(outcome.result.outputs?._?.status).toBe(404);
    expect(outcome.result.outputs?._).toBeDefined();

    const shaped = buildApiTesterResponse(outcome.result.outputs);
    expect(shaped).not.toBeNull();
    if (!shaped) {
      return;
    }
    expect(shaped.status).toBe(404);
    expect(shaped.duration).toBeGreaterThanOrEqual(0);
  });

  it('network failure (status < 0) keeps outputs for Response panel', async () => {
    const closed = http.createServer();
    await new Promise<void>((resolve) => closed.listen(0, '127.0.0.1', resolve));
    const port = (closed.address() as any).port as number;
    await new Promise<void>((resolve) => closed.close(() => resolve()));

    const yaml = [
      'type: api',
      'title: Unreachable',
      `url: http://127.0.0.1:${port}/gone`,
      'method: get',
      '',
    ].join('\n');

    const outcome = await runLocalApi(yaml);
    expect(outcome.result.success).toBe(false);
    expect(outcome.result.outputs?._?.status).toBeLessThan(0);

    const shaped = buildApiTesterResponse(outcome.result.outputs);
    expect(shaped).not.toBeNull();
    if (!shaped) {
      return;
    }
    expect(shaped.status).toBeLessThan(0);
    expect(String(shaped.errorMessage || '')).not.toBe('');
  });

  it('golden bridge: /with-cookie → buildApiTesterResponse cookies', async () => {
    const yaml = [
      'type: api',
      'title: Cookies',
      `url: ${BASE}/with-cookie`,
      'method: get',
      '',
    ].join('\n');

    const outcome = await runLocalApi(yaml);
    expect(outcome.result.success).toBe(true);
    expect(outcome.result.outputs?._?.status).toBe(200);

    const shaped = buildApiTesterResponse(outcome.result.outputs);
    expect(shaped).not.toBeNull();
    if (!shaped) {
      return;
    }
    expect(shaped.status).toBe(200);
    const headers = shaped.headers || {};
    expect(headers['x-echo-method'] || headers['X-Echo-Method']).toBe('GET');
    expect((shaped.cookies || {}).session).toBe('flow-sid');
    expect(shaped.duration).toBeGreaterThanOrEqual(0);

    const setCookie = headers['set-cookie'] ?? headers['Set-Cookie'];
    expect(JSON.stringify(setCookie)).toMatch(/theme=dark/);
  });
});
