// @ts-nocheck
jest.mock('axios/dist/node/axios.cjs', () => ({
  request: jest.fn(),
}));

jest.mock('http2', () => {
  const {EventEmitter} = require('events');
  const connect = jest.fn(() => {
    const session = new EventEmitter();
    session.close = jest.fn();
    session.destroy = jest.fn();
    session.request = jest.fn(() => {
      const stream = new EventEmitter();
      stream.setTimeout = jest.fn();
      stream.close = jest.fn();
      stream.end = jest.fn((body?: string) => {
        stream.body = body;
        stream.emit('response', {
          ':status': 200,
          'content-type': 'text/plain',
          'x-list': ['a', 'b'],
          'x-empty': undefined,
        });
        stream.emit('data', 'ok');
        stream.emit('end');
      });
      return stream;
    });
    return session;
  });
  return {
    connect,
    constants: {NGHTTP2_CANCEL: 8},
  };
});

jest.mock('http', () => {
  const actual = jest.requireActual('http');
  const {EventEmitter} = require('events');
  class FakeHttpAgent {
    constructor(opts) {
      this.options = opts;
      this.destroy = jest.fn();
    }
    createConnection(options, callback) {
      const socket = new EventEmitter();
      socket.destroy = jest.fn();
      FakeHttpAgent.lastSocket = socket;
      FakeHttpAgent.lastOptions = options;
      if (typeof callback === 'function') {
        callback(null, socket);
      }
      return socket;
    }
  }
  return {
    ...actual,
    Agent: FakeHttpAgent,
  };
});

jest.mock('https', () => {
  const actual = jest.requireActual('https');
  const {EventEmitter} = require('events');
  class FakeHttpsAgent {
    constructor(opts) {
      this.options = opts;
      this.destroy = jest.fn();
    }
    createConnection(options, callback) {
      const socket = new EventEmitter();
      socket.destroy = jest.fn();
      FakeHttpsAgent.lastSocket = socket;
      if (typeof callback === 'function') {
        callback(null, socket);
      }
      return socket;
    }
  }
  const request = jest.fn((_opts, _cb) => {
    const req = new EventEmitter();
    req.write = jest.fn();
    req.end = jest.fn(() => {
      process.nextTick(() => {
        req.emit('error', new Error('native https disabled in tests'));
      });
    });
    req.destroy = jest.fn();
    req.setTimeout = jest.fn();
    return req;
  });
  return {
    ...actual,
    Agent: FakeHttpsAgent,
    request,
  };
});

jest.mock('ws', () => {
  const {EventEmitter} = require('events');
  class MockWebSocket extends EventEmitter {
    constructor(url, options) {
      super();
      this.url = url;
      this.options = options;
      this.send = jest.fn();
      this.close = jest.fn();
      MockWebSocket.instances.push(this);
    }
  }
  MockWebSocket.instances = [];
  return MockWebSocket;
});

import {EventEmitter} from 'events';
import {connectionTracker} from './connectionTracker';
import {DEFAULT_NETWORK_CONFIG} from './NetworkData';
import {
  addWsConnection,
  closeAllHttpConnections,
  createHttpAgentWithTracking,
  createHttpsAgentWithCertificates,
  createWebSocket,
  createWebSocketOptionsWithCertificates,
  deleteWsConnection,
  getRunnerNetworkConfig,
  markConnectionIdle,
  recordConnectionActivity,
  send,
  sendHttpRequest,
  sendWsRequest,
  setRunnerNetworkConfig,
  wsConnections,
} from './networkCore';

const axios = require('axios/dist/node/axios.cjs');
const http = require('http');
const https = require('https');
const http2 = require('http2');
const WebSocket = require('ws');

const mockedAxios = axios as unknown as {request: jest.Mock};

describe('networkCore extra coverage', () => {
  beforeEach(() => {
    mockedAxios.request.mockReset();
    http2.connect.mockClear();
    https.request.mockClear();
    mockedAxios.request.mockResolvedValue({
      data: '',
      headers: {date: 'now', skip: undefined},
      status: 200,
      statusText: 'OK',
    });
    WebSocket.instances = [];
    connectionTracker.clear();
    setRunnerNetworkConfig(DEFAULT_NETWORK_CONFIG);
    closeAllHttpConnections();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    connectionTracker.clear();
    closeAllHttpConnections();
  });

  it('applies cookies, drops empty/_ headers, and sniffs json/xml bodies', async () => {
    await sendHttpRequest({
      url: 'http://example.com/x',
      method: 'post',
      cookies: {a: '1', b: '2'},
      headers: {
        'X-Empty': '',
        'X-Null': null as any,
        'User-Agent': '_',
        Accept: '*/*',
      },
      body: '{"ok":true}',
    }, DEFAULT_NETWORK_CONFIG);

    const cfg = mockedAxios.request.mock.calls[0][0];
    expect(cfg.headers.Cookie).toBe('a=1; b=2');
    expect(cfg.headers['User-Agent']).toBeUndefined();
    expect(cfg.headers['Content-Type']).toBe('application/json; charset=utf-8');

    mockedAxios.request.mockClear();
    await sendHttpRequest({
      url: 'http://example.com/x',
      method: 'post',
      body: '<root/>',
    }, DEFAULT_NETWORK_CONFIG);
    expect(mockedAxios.request.mock.calls[0][0].headers['Content-Type'])
        .toBe('application/xml; charset=utf-8');

    mockedAxios.request.mockClear();
    await sendHttpRequest({
      url: 'http://example.com/x',
      method: 'post',
      body: '{not-json',
    }, DEFAULT_NETWORK_CONFIG);
    expect(mockedAxios.request.mock.calls[0][0].headers['Content-Type'])
        .toBe('text/plain; charset=utf-8');
  });

  it('returns axios HTTP error responses and self-signed retries', async () => {
    mockedAxios.request.mockRejectedValueOnce({
      response: {
        data: 'nope',
        headers: {e: 1},
        status: 500,
        statusText: 'ERR',
      },
    });
    const httpErr = await sendHttpRequest(
        {url: 'http://example.com/fail', method: 'get'},
        DEFAULT_NETWORK_CONFIG,
    );
    expect(httpErr).toMatchObject({
      status: 500,
      statusText: 'ERR',
      warning: 'Server returned response: 500 ERR',
    });

    mockedAxios.request
        .mockRejectedValueOnce(Object.assign(new Error('self signed certificate'), {
          code: 'DEPTH_ZERO_SELF_SIGNED_CERT',
        }))
        .mockResolvedValueOnce({data: 'ok', headers: {}, status: 200, statusText: 'OK'});
    const retried = await sendHttpRequest(
        {url: 'https://self.example.com', method: 'get'},
        DEFAULT_NETWORK_CONFIG,
    );
    expect(retried.status).toBe(200);
    expect(retried.warning).toContain('Self-signed certificate warning');

    mockedAxios.request
        .mockRejectedValueOnce(Object.assign(new Error('unable to verify the first certificate'), {
          code: 'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
        }))
        .mockRejectedValueOnce({
          response: {data: 'still-bad', headers: {}, status: 502, statusText: 'Bad'},
        });
    const retryFail = await sendHttpRequest(
        {url: 'https://self.example.com', method: 'get'},
        DEFAULT_NETWORK_CONFIG,
    );
    expect(retryFail.status).toBe(502);
  });

  it('retries certificate-required HTTP responses with native mTLS', async () => {
    mockedAxios.request.mockRejectedValueOnce({
      response: {
        status: 403,
        statusText: 'certificate required',
        data: 'required ssl certificate',
      },
    });
    const {EventEmitter: EE} = require('events');
    https.request.mockImplementationOnce((_opts: any, cb: any) => {
      const req = new EE();
      req.write = jest.fn();
      req.end = jest.fn(() => {
        const res = new EE();
        res.statusCode = 200;
        res.statusMessage = 'OK';
        res.headers = {'content-type': 'text/plain', 'set-cookie': ['a', 'b']};
        cb(res);
        res.emit('data', Buffer.from('native'));
        res.emit('end');
      });
      req.destroy = jest.fn();
      req.setTimeout = jest.fn();
      return req;
    });

    const response = await sendHttpRequest(
        {url: 'https://api.example.com/users', method: 'get', body: 'x'},
        {
          ...DEFAULT_NETWORK_CONFIG,
          ca: {enabled: true, certData: Buffer.from('ca')},
          clients: [{
            id: 'client-1',
            name: 'Company',
            host: 'other.example.com',
            certData: Buffer.from('c'),
            keyData: Buffer.from('k'),
            passphrase_plain: 'pw',
            enabled: true,
          }],
        },
    );
    expect(response.status).toBe(200);
    expect(response.body).toBe('native');
    expect(response.warning).toContain('native mTLS transport');
  });

  it('returns native HTTPS success for matching client certs', async () => {
    const {EventEmitter: EE} = require('events');
    https.request.mockImplementationOnce((opts: any, cb: any) => {
      expect(opts.cert).toEqual(Buffer.from('c'));
      expect(opts.ca).toEqual([Buffer.from('ca')]);
      const req = new EE();
      req.write = jest.fn();
      req.end = jest.fn(() => {
        const res = new EE();
        res.statusCode = 201;
        res.statusMessage = 'Created';
        res.headers = {ok: 'yes', skip: undefined};
        cb(res);
        res.emit('data', 'hi');
        res.emit('end');
      });
      req.destroy = jest.fn();
      req.setTimeout = jest.fn();
      return req;
    });

    const response = await sendHttpRequest(
        {url: 'https://api.example.com/users?x=1', method: 'post', query: {y: '2'}, body: '{}'},
        {
          ...DEFAULT_NETWORK_CONFIG,
          ca: {enabled: true, certData: [Buffer.from('ca')]},
          clients: [{
            id: 'match',
            name: 'Match',
            host: 'api.example.com',
            certData: Buffer.from('c'),
            keyData: Buffer.from('k'),
            enabled: true,
          }],
        },
    );
    expect(response.status).toBe(201);
    expect(response.body).toBe('hi');
  });

  it('uses pfx client certs on the HTTPS agent', () => {
    const agent = createHttpsAgentWithCertificates(
        'api.example.com',
        '443',
        'https:',
        {
          ...DEFAULT_NETWORK_CONFIG,
          sslValidation: false,
          ca: {enabled: true, certData: [Buffer.from('ca')]},
          clients: [{
            id: 'pfx',
            name: 'pfx',
            host: 'api.example.com',
            pfxData: Buffer.from('pfx'),
            passphrase_plain: 'secret',
            enabled: true,
          }],
        },
        {skipCertificateValidation: true},
    );
    expect((agent as any).options.pfx).toEqual(Buffer.from('pfx'));
    expect((agent as any).options.passphrase).toBe('secret');
    expect((agent as any).options.rejectUnauthorized).toBe(false);
  });

  it('tracks HTTP and HTTPS sockets through agent createConnection', () => {
    const httpAgent = createHttpAgentWithTracking('host.example');
    const httpAgent2 = createHttpAgentWithTracking('host.example');
    expect(httpAgent2).toBe(httpAgent);

    const events: any[] = [];
    const unsub = connectionTracker.subscribe((event) => {
      events.push(event);
    });
    const socket = (httpAgent as any).createConnection({hostname: 'host.example', port: 80});
    socket.emit('connect');
    const id = connectionTracker.getAll()[0].id;
    recordConnectionActivity(socket);
    markConnectionIdle(socket);
    expect(connectionTracker.get(id)?.requestCount).toBe(1);
    expect(connectionTracker.get(id)?.state).toBe('idle');
    socket.emit('close', false);
    socket.emit('error');
    socket.emit('timeout');
    socket.emit('end');
    expect(events.some((e) => e.type === 'close' && e.closedBy === 'client')).toBe(true);

    const httpsAgent = createHttpsAgentWithCertificates(
        'secure.example', '443', 'https:', DEFAULT_NETWORK_CONFIG);
    expect(createHttpsAgentWithCertificates(
               'secure.example', '443', 'https:', DEFAULT_NETWORK_CONFIG))
        .toBe(httpsAgent);
    const tlsSocket = (httpsAgent as any).createConnection({host: 'secure.example'});
    tlsSocket.emit('secureConnect');
    const tlsId = connectionTracker.getAll().find((c) => c.host.includes('secure'))?.id;
    (tlsSocket as any).destroy.mockImplementation(() => {
      throw new Error('destroy failed');
    });
    if (tlsId) {
      connectionTracker.requestClose(tlsId);
    }
    tlsSocket.emit('close', true);
    unsub();

    recordConnectionActivity({});
    markConnectionIdle({});
    closeAllHttpConnections();
    expect((httpAgent as any).destroy).toHaveBeenCalled();
  });

  it('covers HTTP/2 query paths, client certs, and transport errors', async () => {
    const cfg = {
      ...DEFAULT_NETWORK_CONFIG,
      httpVersion: '2' as const,
      ca: {enabled: true, certData: Buffer.from('ca')},
      clients: [{
        id: 'c',
        name: 'c',
        host: 'h2.example.com',
        pfxData: Buffer.from('pfx'),
        passphrase_plain: 'pw',
        enabled: true,
      }],
    };

    const ok = await sendHttpRequest({
      url: 'https://h2.example.com/items',
      method: 'post',
      query: {q: '1'},
      headers: {Connection: 'keep-alive', 'X-A': 'b'},
      body: '{"a":1}',
    }, cfg);
    expect(ok.status).toBe(200);
    expect(ok.headers['x-list']).toBe('a, b');
    expect(ok.body).toBe('ok');

    http2.connect.mockImplementationOnce(() => {
      const session = new EventEmitter();
      (session as any).close = jest.fn(() => {
        throw new Error('close fail');
      });
      (session as any).destroy = jest.fn();
      (session as any).request = jest.fn(() => {
        const stream = new EventEmitter();
        (stream as any).setTimeout = jest.fn();
        (stream as any).close = jest.fn();
        (stream as any).end = jest.fn();
        process.nextTick(() => {
          session.emit('error', Object.assign(new Error('h2 down'), {code: 'ECONNRESET'}));
        });
        return stream;
      });
      return session;
    });
    const failed = await sendHttpRequest(
        {url: 'https://h2.example.com/x', method: 'get'},
        {...DEFAULT_NETWORK_CONFIG, httpVersion: '2'},
    );
    expect(failed.status).toBe(-1);

    http2.connect.mockImplementationOnce(() => {
      const session = new EventEmitter();
      (session as any).close = jest.fn();
      (session as any).destroy = jest.fn();
      (session as any).request = jest.fn(() => {
        const stream = new EventEmitter();
        (stream as any).setTimeout = jest.fn();
        (stream as any).close = jest.fn();
        (stream as any).end = jest.fn();
        process.nextTick(() => {
          stream.emit('error', Object.assign(new Error('self signed certificate'), {
            code: 'SELF_SIGNED_CERT_IN_CHAIN',
          }));
        });
        return stream;
      });
      return session;
    });
    http2.connect.mockImplementationOnce(() => {
      const session = new EventEmitter();
      (session as any).close = jest.fn();
      (session as any).destroy = jest.fn();
      (session as any).request = jest.fn(() => {
        const stream = new EventEmitter();
        (stream as any).setTimeout = jest.fn();
        (stream as any).close = jest.fn();
        (stream as any).end = jest.fn();
        process.nextTick(() => {
          stream.emit('error', Object.assign(new Error('still bad'), {
            request: {res: {body: 'from-res'}},
          }));
        });
        return stream;
      });
      return session;
    });
    const selfSigned = await sendHttpRequest(
        {url: 'https://h2.example.com/x', method: 'get'},
        {...DEFAULT_NETWORK_CONFIG, httpVersion: '2'},
    );
    expect(selfSigned.status).toBe(-1);
    expect(selfSigned.body).toBe('from-res');
    expect(selfSigned.warning).toContain('Self-signed');
  });

  it('times out HTTP/2 requests', async () => {
    http2.connect.mockReset();
    http2.connect.mockImplementation(() => {
      const session = new EventEmitter();
      (session as any).close = jest.fn();
      (session as any).destroy = jest.fn();
      (session as any).request = jest.fn(() => {
        const stream = new EventEmitter();
        (stream as any).setTimeout = jest.fn();
        (stream as any).close = jest.fn();
        (stream as any).end = jest.fn();
        return stream;
      });
      return session;
    });
    jest.useFakeTimers();
    const pending = sendHttpRequest(
        {url: 'https://slow.example.com', method: 'get', timeout: 50},
        {...DEFAULT_NETWORK_CONFIG, httpVersion: '2'},
    );
    jest.advanceTimersByTime(50);
    const timedOut = await pending;
    expect(timedOut.status).toBe(-1);
    expect(timedOut.statusText).toContain('TIMEOUT');
  });

  it('manages websocket helpers and one-shot sendWsRequest', async () => {
    jest.useFakeTimers();
    const wsOpts = createWebSocketOptionsWithCertificates(
        'sock.example.com',
        '443',
        'wss:',
        {
          ...DEFAULT_NETWORK_CONFIG,
          ca: {enabled: true, certData: Buffer.from('ca')},
          clients: [{
            id: 'c',
            name: 'c',
            host: 'sock.example.com',
            certData: Buffer.from('c'),
            keyData: Buffer.from('k'),
            passphrase_plain: 'pw',
            enabled: true,
          }],
        },
    );
    expect(wsOpts.ca).toEqual([Buffer.from('ca')]);
    expect(wsOpts.cert).toEqual(Buffer.from('c'));

    const pfxOpts = createWebSocketOptionsWithCertificates(
        'sock.example.com',
        undefined,
        'wss:',
        {
          ...DEFAULT_NETWORK_CONFIG,
          ca: {enabled: true, certData: [Buffer.from('ca')]},
          clients: [{
            id: 'c',
            name: 'c',
            host: 'sock.example.com',
            pfxData: Buffer.from('pfx'),
            enabled: true,
          }],
        },
        {skipCertificateValidation: true},
    );
    expect(pfxOpts.rejectUnauthorized).toBe(false);
    expect(pfxOpts.pfx).toEqual(Buffer.from('pfx'));

    const {ws, wsId} = createWebSocket('ws://example.com/x', 'id-1', DEFAULT_NETWORK_CONFIG);
    expect(wsId).toBe('id-1');
    expect(wsConnections('id-1')).toBeUndefined();
    addWsConnection('id-1', ws);
    expect(wsConnections('id-1')).toBe(ws);
    expect(deleteWsConnection('id-1')).toBe(ws);
    expect(ws.close).toHaveBeenCalled();
    expect(deleteWsConnection('missing')).toBeUndefined();

    const wss = createWebSocket('wss://sock.example.com/x', 'id-2', DEFAULT_NETWORK_CONFIG);
    expect((wss.ws as any).options.rejectUnauthorized).toBe(true);

    const messageP = sendWsRequest(
        {url: 'wss://sock.example.com', body: {hello: true}},
        DEFAULT_NETWORK_CONFIG,
    );
    const live = WebSocket.instances[WebSocket.instances.length - 1];
    live.emit('open');
    expect(live.send).toHaveBeenCalledWith(JSON.stringify({hello: true}));
    live.emit('message', Buffer.from('pong'));
    await expect(messageP).resolves.toMatchObject({status: 200, body: 'pong'});

    const closeP = sendWsRequest(
        {url: 'ws://example.com', body: 'hi'},
        DEFAULT_NETWORK_CONFIG,
    );
    const closer = WebSocket.instances[WebSocket.instances.length - 1];
    closer.emit('close');
    await expect(closeP).resolves.toMatchObject({status: 200, body: ''});

    const errP = sendWsRequest(
        {url: 'ws://example.com'},
        DEFAULT_NETWORK_CONFIG,
    );
    const errWs = WebSocket.instances[WebSocket.instances.length - 1];
    errWs.emit('error', new Error('ws fail'));
    await expect(errP).rejects.toMatchObject({status: -1, errorMessage: 'ws fail'});

    jest.useFakeTimers();
    const timeoutP = sendWsRequest(
        {url: 'ws://example.com'},
        {...DEFAULT_NETWORK_CONFIG, timeout: 25},
    );
    jest.advanceTimersByTime(25);
    await expect(timeoutP).rejects.toMatchObject({errorCode: 'TIMEOUT'});
  });

  it('setRunnerNetworkConfig clones config and send dispatches protocols', async () => {
    await expect(send({})).rejects.toThrow('URL is required');
    await expect(send({url: 'x', protocol: 'grpc' as any}))
        .rejects.toThrow('Unsupported protocol');

    setRunnerNetworkConfig(undefined as any);
    expect(getRunnerNetworkConfig()).toMatchObject({timeout: 30000});

    const cfg = {
      ...DEFAULT_NETWORK_CONFIG,
      timeout: 11,
      clients: [{id: '1', name: 'n', host: '*', enabled: true}] as any,
    };
    setRunnerNetworkConfig(cfg);
    cfg.timeout = 99;
    cfg.clients[0].name = 'mutated';
    expect(getRunnerNetworkConfig().timeout).toBe(11);
    expect(getRunnerNetworkConfig().clients[0].name).toBe('n');

    mockedAxios.request.mockResolvedValueOnce({
      data: 'ok',
      headers: {},
      status: 201,
      statusText: 'Created',
    });
    const httpRes = await send({
      url: 'http://example.com',
      protocol: 'graphql',
      method: 'post',
      body: {a: 1},
    });
    expect(httpRes.status).toBe(201);
    expect(mockedAxios.request.mock.calls[0][0].data).toBe(JSON.stringify({a: 1}));

    const wsResP = send({
      url: 'ws://example.com',
      protocol: 'ws',
      body: 'hi',
    });
    const live = WebSocket.instances[WebSocket.instances.length - 1];
    live.emit('open');
    live.emit('message', 'ack');
    await expect(wsResP).resolves.toMatchObject({status: 200, body: 'ack'});
  });

  it('extracts error bodies from http2 failures', async () => {
    http2.connect.mockReset();
    http2.connect.mockImplementationOnce(() => {
      const session = new EventEmitter();
      (session as any).close = jest.fn();
      (session as any).destroy = jest.fn();
      (session as any).request = jest.fn(() => {
        const stream = new EventEmitter();
        (stream as any).setTimeout = jest.fn();
        (stream as any).close = jest.fn();
        (stream as any).end = jest.fn();
        process.nextTick(() => {
          stream.emit('error', {response: {data: {x: 1}}});
        });
        return stream;
      });
      return session;
    });
    const jsonBody = await sendHttpRequest(
        {url: 'https://example.com', method: 'get'},
        {...DEFAULT_NETWORK_CONFIG, httpVersion: '2'},
    );
    expect(jsonBody.status).toBe(-1);
    expect(jsonBody.body).toBe(JSON.stringify({x: 1}));

    http2.connect.mockImplementationOnce(() => {
      const session = new EventEmitter();
      (session as any).close = jest.fn();
      (session as any).destroy = jest.fn();
      (session as any).request = jest.fn(() => {
        const stream = new EventEmitter();
        (stream as any).setTimeout = jest.fn();
        (stream as any).close = jest.fn();
        (stream as any).end = jest.fn();
        process.nextTick(() => {
          stream.emit('error', {
            request: {res: {_readableState: {buffer: [{data: Buffer.from('chunked')}]}}},
          });
        });
        return stream;
      });
      return session;
    });
    const chunked = await sendHttpRequest(
        {url: 'https://example.com', method: 'get'},
        {...DEFAULT_NETWORK_CONFIG, httpVersion: '2'},
    );
    expect(chunked.body).toBe('chunked');

    mockedAxios.request.mockRejectedValueOnce({
      cause: {code: 'ECONNREFUSED'},
      message: 'connect failed',
    });
    const caused = await sendHttpRequest(
        {url: 'http://example.com', method: 'get'},
        DEFAULT_NETWORK_CONFIG,
    );
    expect(caused.statusText).toContain('ECONNREFUSED');
  });

  it('covers remaining native, http2, retry, and error-format branches', async () => {
    const {EventEmitter: EE} = require('events');

    https.request.mockImplementationOnce((opts: any, cb: any) => {
      expect(opts.pfx).toEqual(Buffer.from('pfx'));
      const req = new EE();
      req.write = jest.fn();
      req.end = jest.fn(() => {
        const res = new EE();
        res.statusCode = 400;
        res.statusMessage = 'Bad';
        res.headers = {};
        cb(res);
        res.emit('end');
      });
      req.destroy = jest.fn();
      req.setTimeout = jest.fn();
      return req;
    });
    const native400 = await sendHttpRequest(
        {url: 'https://pfx.example.com/x', method: 'get'},
        {
          ...DEFAULT_NETWORK_CONFIG,
          clients: [{
            id: 'pfx',
            name: 'pfx',
            host: 'pfx.example.com',
            pfxData: Buffer.from('pfx'),
            enabled: true,
          }],
        },
    );
    expect(native400.status).toBe(400);
    expect(native400.warning).toContain('400');

    https.request.mockImplementationOnce((_opts: any, _cb: any) => {
      const req = new EE();
      req.write = jest.fn();
      req.end = jest.fn();
      req.destroy = jest.fn((err?: Error) => {
        if (err) {
          process.nextTick(() => {
            req.emit('error', err);
          });
        }
      });
      req.setTimeout = jest.fn((_ms: number, fn: () => void) => {
        fn();
      });
      return req;
    });
    const nativeTimeout = await sendHttpRequest(
        {url: 'https://pfx.example.com/x', method: 'post', body: 'z'},
        {
          ...DEFAULT_NETWORK_CONFIG,
          clients: [{
            id: 'pfx',
            name: 'pfx',
            host: 'pfx.example.com',
            pfxData: Buffer.from('pfx'),
            enabled: true,
          }],
        },
    );
    expect(nativeTimeout.status).toBe(200);

    mockedAxios.request
        .mockRejectedValueOnce(Object.assign(new Error('alert certificate required'), {
          code: 'ERR_SSL_TLSV13_ALERT_CERTIFICATE_REQUIRED',
        }))
        .mockRejectedValueOnce({response: {status: 500, statusText: '', data: ''}});
    const retryFail = await sendHttpRequest(
        {url: 'https://api.example.com', method: 'get'},
        {
          ...DEFAULT_NETWORK_CONFIG,
          clients: [{
            id: 'only',
            name: 'Only',
            host: 'other.example.com',
            certData: Buffer.from('c'),
            keyData: Buffer.from('k'),
            enabled: true,
          }],
        },
    );
    expect(retryFail.status).toBe(500);

    mockedAxios.request.mockRejectedValueOnce({
      response: {
        status: 400,
        statusText: 'certificate required',
        data: 'required ssl certificate',
      },
    });
    https.request.mockImplementationOnce((_opts: any) => {
      const req = new EE();
      req.write = jest.fn();
      req.end = jest.fn(() => {
        process.nextTick(() => {
          req.emit('error', {originalError: {code: 'EPIPE'}, message: 'native fail'});
        });
      });
      req.destroy = jest.fn();
      req.setTimeout = jest.fn();
      return req;
    });
    const nativeRetryFail = await sendHttpRequest(
        {url: 'https://api.example.com', method: 'get'},
        {
          ...DEFAULT_NETWORK_CONFIG,
          clients: [{
            id: 'only',
            name: 'Only',
            host: 'other.example.com',
            certData: Buffer.from('c'),
            keyData: Buffer.from('k'),
            enabled: true,
          }],
        },
    );
    expect(nativeRetryFail.status).toBe(-1);
    expect(nativeRetryFail.statusText).toContain('EPIPE');

    mockedAxios.request.mockRejectedValueOnce({response: {status: 418}});
    const teapot = await sendHttpRequest(
        {url: 'http://example.com', method: 'get', headers: {'Content-Type': 'text/plain'}, body: 'x'},
        DEFAULT_NETWORK_CONFIG,
    );
    expect(teapot.warning).toBe('Server returned response: 418');

    http2.connect.mockReset();
    http2.connect.mockImplementationOnce(() => {
      const session = new EventEmitter();
      (session as any).close = jest.fn();
      (session as any).destroy = jest.fn();
      (session as any).request = jest.fn(() => {
        const stream = new EventEmitter();
        (stream as any).close = jest.fn();
        (stream as any).end = jest.fn();
        (stream as any).setTimeout = jest.fn((_ms: number, cb: () => void) => {
          process.nextTick(cb);
        });
        return stream;
      });
      return session;
    });
    const h2StreamTimeout = await sendHttpRequest(
        {url: 'https://h2.example.com/x', method: 'get'},
        {
          ...DEFAULT_NETWORK_CONFIG,
          httpVersion: '2',
          ca: {enabled: true, certData: [Buffer.from('ca')]},
          clients: [{
            id: 'ck',
            name: 'ck',
            host: 'h2.example.com',
            certData: Buffer.from('c'),
            keyData: Buffer.from('k'),
            enabled: true,
          }],
        },
    );
    expect(h2StreamTimeout.statusText).toContain('TIMEOUT');

    http2.connect.mockImplementationOnce(() => {
      const session = new EventEmitter();
      (session as any).close = jest.fn();
      (session as any).destroy = jest.fn();
      (session as any).request = jest.fn(() => {
        const stream = new EventEmitter();
        (stream as any).setTimeout = jest.fn();
        (stream as any).close = jest.fn();
        (stream as any).end = jest.fn();
        process.nextTick(() => {
          stream.emit('error', {response: {data: 'plain-body'}});
        });
        return stream;
      });
      return session;
    });
    const plain = await sendHttpRequest(
        {url: 'https://h2.example.com/x', method: 'get'},
        {...DEFAULT_NETWORK_CONFIG, httpVersion: '2'},
    );
    expect(plain.body).toBe('plain-body');

    http2.connect.mockImplementationOnce(() => {
      const session = new EventEmitter();
      (session as any).close = jest.fn();
      (session as any).destroy = jest.fn();
      (session as any).request = jest.fn(() => {
        const stream = new EventEmitter();
        (stream as any).setTimeout = jest.fn();
        (stream as any).close = jest.fn();
        (stream as any).end = jest.fn();
        process.nextTick(() => {
          stream.emit('error', {request: {res: {_body: 'alt-body'}}});
        });
        return stream;
      });
      return session;
    });
    const alt = await sendHttpRequest(
        {url: 'https://h2.example.com/x', method: 'get'},
        {...DEFAULT_NETWORK_CONFIG, httpVersion: '2'},
    );
    expect(alt.body).toBe('alt-body');

    mockedAxios.request.mockResolvedValueOnce({
      data: 'bin-ok',
      headers: {},
      status: 200,
      statusText: 'OK',
    });
    const bufRes = await send({
      url: 'http://example.com',
      protocol: 'http',
      body: Buffer.from('bin'),
    });
    expect(bufRes.status).toBeDefined();
  });
});
