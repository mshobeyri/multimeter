import {
  echoWebSocketMessage,
  handleLocalTestServerHttp,
  isLocalMmtDevHostname,
  isLocalMmtDevUrl,
  LOCAL_MMT_DEV_HOST,
} from './localTestServer';
import {send, setRunnerNetworkConfig} from './networkCore';
import {DEFAULT_NETWORK_CONFIG} from '../data/NetworkData';

describe('local.mmt.dev host detection', () => {
  it('matches local.mmt.dev and subdomains', () => {
    expect(isLocalMmtDevHostname('local.mmt.dev')).toBe(true);
    expect(isLocalMmtDevHostname('LOCAL.MMT.DEV')).toBe(true);
    expect(isLocalMmtDevHostname('api.local.mmt.dev')).toBe(true);
    expect(isLocalMmtDevHostname('test.mmt.dev')).toBe(false);
    expect(isLocalMmtDevHostname('localhost')).toBe(false);
    expect(isLocalMmtDevUrl('https://local.mmt.dev/echo')).toBe(true);
    expect(isLocalMmtDevUrl('wss://local.mmt.dev/ws')).toBe(true);
    expect(isLocalMmtDevUrl('https://test.mmt.dev/echo')).toBe(false);
  });
});

describe('handleLocalTestServerHttp', () => {
  it('serves the index help page', async () => {
    const res = await handleLocalTestServerHttp({
      method: 'GET',
      url: `https://${LOCAL_MMT_DEV_HOST}/`,
      headers: {},
    });
    expect(res.status).toBe(200);
    const body = JSON.parse(String(res.body));
    expect(body.service).toBe('Multimeter Test Server');
    expect(body.url).toBe(`https://${LOCAL_MMT_DEV_HOST}`);
    expect(body.endpoints.length).toBeGreaterThan(5);
  });

  it('echoes JSON body, query, and headers (including /echo/* paths)', async () => {
    const res = await handleLocalTestServerHttp({
      method: 'POST',
      url: `https://${LOCAL_MMT_DEV_HOST}/echo/alice?q=1`,
      headers: {
        'Content-Type': 'application/json',
        'X-Trace': 'abc',
      },
      bodyText: JSON.stringify({hello: 'world'}),
    });
    expect(res.status).toBe(200);
    const body = JSON.parse(String(res.body));
    expect(body.method).toBe('POST');
    expect(body.path).toBe('/echo/alice');
    expect(body.query).toEqual({q: '1'});
    expect(body.headers['X-Trace'] || body.headers['x-trace']).toBe('abc');
    expect(body.body).toEqual({hello: 'world'});
  });

  it('returns status codes and sample JSON', async () => {
    const status = await handleLocalTestServerHttp({
      method: 'GET',
      url: `https://${LOCAL_MMT_DEV_HOST}/status/418`,
      headers: {},
    });
    expect(status.status).toBe(418);
    expect(JSON.parse(String(status.body)).description).toMatch(/Teapot/i);

    const json = await handleLocalTestServerHttp({
      method: 'GET',
      url: `https://${LOCAL_MMT_DEV_HOST}/json`,
      headers: {},
    });
    expect(JSON.parse(String(json.body)).name).toBe('Multimeter');
  });

  it('checks basic and bearer auth', async () => {
    const basicOk = await handleLocalTestServerHttp({
      method: 'GET',
      url: `https://${LOCAL_MMT_DEV_HOST}/auth/basic`,
      headers: {Authorization: `Basic ${Buffer.from('user:pass').toString('base64')}`},
    });
    expect(basicOk.status).toBe(200);
    expect(JSON.parse(String(basicOk.body)).authenticated).toBe(true);

    const bearerBad = await handleLocalTestServerHttp({
      method: 'GET',
      url: `https://${LOCAL_MMT_DEV_HOST}/auth/bearer`,
      headers: {Authorization: 'Bearer nope'},
    });
    expect(bearerBad.status).toBe(401);
  });

  it('issues a local oauth token', async () => {
    const res = await handleLocalTestServerHttp({
      method: 'POST',
      url: `https://${LOCAL_MMT_DEV_HOST}/token`,
      headers: {'Content-Type': 'application/x-www-form-urlencoded'},
      bodyText: 'grant_type=client_credentials',
    });
    expect(res.status).toBe(200);
    expect(JSON.parse(String(res.body))).toMatchObject({
      access_token: 'tok-local',
      token_type: 'Bearer',
    });
  });

  it('delays then responds', async () => {
    const started = Date.now();
    const res = await handleLocalTestServerHttp({
      method: 'GET',
      url: `https://${LOCAL_MMT_DEV_HOST}/delay/30`,
      headers: {},
    });
    expect(Date.now() - started).toBeGreaterThanOrEqual(25);
    expect(JSON.parse(String(res.body)).delayed).toBe(30);
  });

  it('sets cookies from query params', async () => {
    const res = await handleLocalTestServerHttp({
      method: 'GET',
      url: `https://${LOCAL_MMT_DEV_HOST}/cookies/set?session=abc&theme=dark`,
      headers: {},
    });
    expect(res.status).toBe(200);
    expect(res.headers['Set-Cookie']).toEqual([
      'session=abc; Path=/',
      'theme=dark; Path=/',
    ]);
  });

  it('echoes /with-cookie with Set-Cookie for tester flows', async () => {
    const res = await handleLocalTestServerHttp({
      method: 'GET',
      url: `https://${LOCAL_MMT_DEV_HOST}/with-cookie`,
      headers: {},
    });
    expect(res.status).toBe(200);
    expect(res.headers['X-Echo-Method']).toBe('GET');
    expect(res.headers['Set-Cookie']).toEqual([
      'session=flow-sid; Path=/',
      'theme=dark',
    ]);
  });
});

describe('echoWebSocketMessage', () => {
  it('round-trips JSON and plain text', () => {
    expect(echoWebSocketMessage('{"a":1}')).toBe('{"a":1}');
    expect(echoWebSocketMessage('hello')).toBe('hello');
  });
});

describe('networkCore local.mmt.dev bypass (no internet)', () => {
  beforeEach(() => {
    setRunnerNetworkConfig(DEFAULT_NETWORK_CONFIG);
  });

  it('send() answers https://local.mmt.dev/echo without sockets', async () => {
    const res = await send({
      url: 'https://local.mmt.dev/echo/unit',
      method: 'post',
      protocol: 'http',
      headers: {'Content-Type': 'application/json', 'X-Test': '1'},
      query: {q: 'z'},
      body: JSON.stringify({n: 3}),
    });
    expect(res.status).toBe(200);
    expect(res.duration).toBeGreaterThanOrEqual(0);
    const body = typeof res.body === 'string' ? JSON.parse(res.body) : res.body;
    expect(body.path).toBe('/echo/unit');
    expect(body.query).toEqual({q: 'z'});
    expect(body.body).toEqual({n: 3});
    expect(body.headers['X-Test'] || body.headers['x-test']).toBe('1');
    // Default Multimeter headers are applied before the local hand-off.
    expect(String(body.headers['User-Agent'] || body.headers['user-agent'] || ''))
        .toMatch(/Multimeter/i);
  });

  it('follows local redirects', async () => {
    const res = await send({
      url: 'https://local.mmt.dev/redirect/2',
      method: 'get',
      protocol: 'http',
    });
    expect(res.status).toBe(200);
    const body = typeof res.body === 'string' ? JSON.parse(res.body) : res.body;
    expect(body.redirected).toBe(true);
  });

  it('send() echoes over ws://local.mmt.dev/ws', async () => {
    const res = await send({
      url: 'ws://local.mmt.dev/ws',
      protocol: 'ws',
      body: JSON.stringify({ping: true}),
    });
    expect(res.status).toBe(200);
    expect(JSON.parse(String(res.body))).toEqual({ping: true});
  });
});
