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
        stream.emit('response', {':status': 200, 'content-type': 'text/plain'});
        stream.emit('data', Buffer.from('ok'));
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

import {DEFAULT_NETWORK_CONFIG} from './NetworkData';
import {createHttpsAgentWithCertificates, sendHttpRequest} from './networkCore';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const axios = require('axios/dist/node/axios.cjs');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const http2 = require('http2');

describe('networkCore request timeout', () => {
  const mockedAxios = axios as unknown as { request: jest.Mock };

  beforeEach(() => {
    mockedAxios.request.mockReset();
    http2.connect.mockClear();
    mockedAxios.request.mockResolvedValue({
      data: '',
      headers: {},
      status: 200,
      statusText: 'OK',
    });
  });

  it('uses request timeout when provided', async () => {
    await sendHttpRequest(
        {url: 'http://example.com', method: 'get', timeout: 5000},
        {...DEFAULT_NETWORK_CONFIG, timeout: 30000},
    );

    expect(mockedAxios.request).toHaveBeenCalledWith(
        expect.objectContaining({timeout: 5000}),
    );
  });

  it('falls back to network config timeout when request timeout is missing', async () => {
    await sendHttpRequest(
        {url: 'http://example.com', method: 'get'},
        {...DEFAULT_NETWORK_CONFIG, timeout: 30000},
    );

    expect(mockedAxios.request).toHaveBeenCalledWith(
        expect.objectContaining({timeout: 30000}),
    );
  });

  it('uses the basic HTTP/2 transport when configured', async () => {
    const response = await sendHttpRequest(
        {url: 'https://example.com/users', method: 'get'},
        {...DEFAULT_NETWORK_CONFIG, httpVersion: '2'},
    );

    expect(mockedAxios.request).not.toHaveBeenCalled();
    expect(http2.connect).toHaveBeenCalledWith(
        'https://example.com',
        expect.objectContaining({rejectUnauthorized: true}),
    );
    expect(response.status).toBe(200);
    expect(response.body).toBe('ok');
    expect(response.headers['content-type']).toBe('text/plain');
  });

  it('applies TLS compatibility defaults to HTTPS agents', () => {
    const agent = createHttpsAgentWithCertificates(
        'tls-agent.example.com',
        '443',
        'https:',
        DEFAULT_NETWORK_CONFIG,
    );

    expect((agent as any).options).toMatchObject({
      keepAlive: false,
      maxCachedSessions: 0,
    });
    expect((agent as any).options.secureOptions).toBeGreaterThan(0);
  });

  it('applies TLS compatibility defaults to HTTP/2 sessions', async () => {
    await sendHttpRequest(
        {url: 'https://http2-tls.example.com/users', method: 'get'},
        {
          ...DEFAULT_NETWORK_CONFIG,
          httpVersion: '2',
        },
    );

    expect(http2.connect).toHaveBeenCalledWith(
        'https://http2-tls.example.com',
        expect.objectContaining({
          rejectUnauthorized: true,
          maxCachedSessions: 0,
          secureOptions: expect.any(Number),
        }),
    );
  });

  it('uses the default transport when HTTP version is auto', async () => {
    await sendHttpRequest(
        {url: 'https://example.com/users', method: 'get'},
        {...DEFAULT_NETWORK_CONFIG, httpVersion: 'auto'},
    );

    expect(mockedAxios.request).toHaveBeenCalled();
    expect(http2.connect).not.toHaveBeenCalled();
  });

  it('includes TLS error details in network failure status text', async () => {
    mockedAxios.request.mockRejectedValueOnce(Object.assign(
        new Error('ssl3 alert handshake failure'),
        {
          code: 'ERR_SSL_SSLV3_ALERT_HANDSHAKE_FAILURE',
          reason: 'sslv3 alert handshake failure',
          opensslErrorStack: ['error:0A000152:SSL routines::unsafe legacy renegotiation disabled'],
        },
    ));

    const response = await sendHttpRequest(
        {url: 'https://tls-error.example.com', method: 'get'},
        DEFAULT_NETWORK_CONFIG,
    );

    expect(response.status).toBe(-1);
    expect(response.statusText).toContain('ERR_SSL_SSLV3_ALERT_HANDSHAKE_FAILURE');
    expect(response.statusText).toContain('ssl3 alert handshake failure');
    expect(response.statusText).toContain('unsafe legacy renegotiation disabled');
  });
});
