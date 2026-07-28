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

  it('sends Buffer bodies with octet-stream and byte Content-Length', async () => {
    const body = Buffer.from([0x00, 0xff, 0x80, 0x7f]);
    await sendHttpRequest(
        {url: 'http://example.com/upload', method: 'post', body},
        DEFAULT_NETWORK_CONFIG,
    );

    expect(mockedAxios.request).toHaveBeenCalledWith(
        expect.objectContaining({
          data: body,
          headers: expect.objectContaining({
            'Content-Type': 'application/octet-stream',
            'Content-Length': '4',
          }),
        }),
    );
  });

  it('does not sniff Buffer bodies as JSON even if bytes look like text', async () => {
    const body = Buffer.from('{"a":1}');
    await sendHttpRequest(
        {url: 'http://example.com/upload', method: 'post', body},
        DEFAULT_NETWORK_CONFIG,
    );

    expect(mockedAxios.request).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/octet-stream',
          }),
        }),
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

  it('retries certificate-required TLS failures with the only available client cert', async () => {
    mockedAxios.request
        .mockRejectedValueOnce(Object.assign(
            new Error('tlsv1 alert certificate required'),
            {code: 'ERR_SSL_TLSV1_ALERT_CERTIFICATE_REQUIRED'},
        ))
        .mockResolvedValueOnce({
          data: 'ok',
          headers: {},
          status: 200,
          statusText: 'OK',
        });

    const certData = Buffer.from('client-cert');
    const keyData = Buffer.from('client-key');
    const response = await sendHttpRequest(
        {url: 'https://api.example.com/users', method: 'get'},
        {
          ...DEFAULT_NETWORK_CONFIG,
          clients: [{
            id: 'client-1',
            name: 'Company API',
            host: 'does-not-match.example.com',
            certData,
            keyData,
            enabled: true,
          }],
        },
    );

    expect(response.status).toBe(200);
    expect(response.warning).toContain('retried with "Company API"');
    expect(mockedAxios.request).toHaveBeenCalledTimes(2);
    const retryConfig = mockedAxios.request.mock.calls[1][0];
    expect((retryConfig.httpsAgent as any).options.cert).toBe(certData);
    expect((retryConfig.httpsAgent as any).options.key).toBe(keyData);
    expect((retryConfig.httpsAgent as any).options.maxVersion).toBe('TLSv1.2');
  });

  it('retries certificate-required TLS failures with a matching star client cert', async () => {
    mockedAxios.request
        .mockRejectedValueOnce(Object.assign(
            new Error('tlsv1 alert certificate required'),
            {code: 'ERR_SSL_TLSV1_ALERT_CERTIFICATE_REQUIRED'},
        ))
        .mockResolvedValueOnce({
          data: 'ok',
          headers: {},
          status: 200,
          statusText: 'OK',
        });

    const certData = Buffer.from('star-client-cert');
    const keyData = Buffer.from('star-client-key');
    const response = await sendHttpRequest(
        {url: 'https://api.example.com/users', method: 'get'},
        {
          ...DEFAULT_NETWORK_CONFIG,
          clients: [{
            id: 'client-star',
            name: 'Wildcard Company API',
            host: '*',
            certData,
            keyData,
            enabled: true,
          }],
        },
    );

    expect(response.status).toBe(200);
    expect(response.warning).toContain('legacy mTLS compatibility');
    expect(mockedAxios.request).toHaveBeenCalledTimes(2);
    const firstConfig = mockedAxios.request.mock.calls[0][0];
    const retryConfig = mockedAxios.request.mock.calls[1][0];
    expect((firstConfig.httpsAgent as any).options.cert).toBe(certData);
    expect((firstConfig.httpsAgent as any).options.maxVersion).toBe('TLSv1.2');
    expect((retryConfig.httpsAgent as any).options.cert).toBe(certData);
    expect((retryConfig.httpsAgent as any).options.maxVersion).toBe('TLSv1.2');
  });

  it('uses mTLS compatibility on the first request for any-host fixed-port matches', async () => {
    const certData = Buffer.from('port-client-cert');
    const keyData = Buffer.from('port-client-key');

    await sendHttpRequest(
        {url: 'https://xxxx.yyy.zz.aaaa.bbbb:8085/xxx/yyy', method: 'get'},
        {
          ...DEFAULT_NETWORK_CONFIG,
          clients: [{
            id: 'client-port',
            name: 'Port Client',
            host: '*:8085',
            certData,
            keyData,
            enabled: true,
          }],
        },
    );

    expect(mockedAxios.request).toHaveBeenCalledTimes(1);
    const firstConfig = mockedAxios.request.mock.calls[0][0];
    expect((firstConfig.httpsAgent as any).options.cert).toBe(certData);
    expect((firstConfig.httpsAgent as any).options.key).toBe(keyData);
    expect((firstConfig.httpsAgent as any).options.maxVersion).toBe('TLSv1.2');
  });
});
