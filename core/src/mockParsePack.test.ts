import {mockToYaml, parseMockData, yamlToMock} from './mockParsePack';

describe('mockParsePack', () => {
  it('mockToYaml does not add title when missing', () => {
    const yaml = mockToYaml({type: 'server', port: 8080, endpoints: []});
    expect(yaml).toContain('type: server');
    expect(yaml).not.toContain('title:');
  });

  it('canonicalizes mock keys and keeps endpoints before fallback', () => {
    const yaml = mockToYaml({
      type: 'server',
      port: 8080,
      fallback: {status: 404},
      endpoints: [{method: 'get', path: '/health', status: 200}],
    });
    expect(yaml.indexOf('port: 8080')).toBeGreaterThan(yaml.indexOf('type: server'));
    expect(yaml.indexOf('endpoints:')).toBeLessThan(yaml.indexOf('fallback:'));
  });

  it('preserves websocket messages when parsing and formatting', () => {
    const parsed = yamlToMock(`
type: server
port: 8080
protocol: ws
endpoints:
  - path: /socket
    messages:
      - match:
          type: ping
        body:
          type: pong
`);
    const yaml = mockToYaml(parsed!);
    expect(yaml).toContain('messages:');
    expect(yaml).toContain('type: pong');
  });

  it('accepts https protocol with tls connection config', () => {
    const {data, errors} = parseMockData({
      type: 'server',
      protocol: 'https',
      port: 8443,
      connection: {mode: 'tls', cert: './certs/server.crt', key: './certs/server.key'},
      endpoints: [{method: 'get', path: '/health'}],
    });

    expect(errors.filter(error => error.severity === 'error')).toEqual([]);
    expect(data?.protocol).toBe('https');
    expect(data?.connection?.mode).toBe('tls');
  });

  it('allows https tls connection without custom certs', () => {
    const {data, errors} = parseMockData({
      type: 'server',
      protocol: 'https',
      port: 8443,
      connection: {mode: 'tls'},
      endpoints: [{method: 'get', path: '/health'}],
    });

    expect(errors.filter(error => error.severity === 'error')).toEqual([]);
    expect(data?.connection?.mode).toBe('tls');
    expect(data?.connection?.cert).toBeUndefined();
  });

  it('requires client CA for mtls connection mode', () => {
    const {data, errors} = parseMockData({
      type: 'server',
      protocol: 'https',
      port: 8444,
      connection: {mode: 'mtls', cert: './certs/server.crt', key: './certs/server.key'},
      endpoints: [{method: 'get', path: '/secure'}],
    });

    expect(data).toBeNull();
    expect(errors.map(error => error.message)).toContain('connection.client_ca is required when connection.mode is mtls');
  });

  it('rejects tls as a protocol value', () => {
    const {data, errors} = parseMockData({
      type: 'server',
      protocol: 'tls',
      port: 8443,
      endpoints: [{method: 'get', path: '/health'}],
    });

    expect(data).toBeNull();
    expect(errors.map(error => error.message)).toContain('protocol must be one of: http, https, ws');
  });

  it('warns on removed top-level tls field', () => {
    const {errors} = parseMockData({
      type: 'server',
      protocol: 'https',
      port: 8443,
      tls: {cert: './certs/server.crt', key: './certs/server.key'},
      endpoints: [{method: 'get', path: '/health'}],
    });

    expect(errors.map(error => error.message)).toContain('Unknown field: tls');
  });
});