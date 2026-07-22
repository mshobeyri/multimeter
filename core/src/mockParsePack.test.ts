import {mockToYaml, parseMockData, resolveMockPort, resolveMockProtocol, yamlToMock} from './mockParsePack';

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
    expect(errors.map(error => error.message)).toContain(
        'protocol must be one of: http, https, ws, or an env token like e:MOCK_PROTOCOL');
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

  it('accepts env token ports like e:MOCK_PORT', () => {
    const {data, errors} = parseMockData({
      type: 'server',
      port: 'e:MOCK_PORT',
      endpoints: [{method: 'get', path: '/health'}],
    });

    expect(errors.filter(error => error.severity === 'error')).toEqual([]);
    expect(data?.port).toBe('e:MOCK_PORT');
  });

  it('accepts angle-bracket env token ports', () => {
    const {data, errors} = parseMockData({
      type: 'server',
      port: '<<e:MOCK_PORT>>',
      endpoints: [{method: 'get', path: '/health'}],
    });

    expect(errors.filter(error => error.severity === 'error')).toEqual([]);
    expect(data?.port).toBe('<<e:MOCK_PORT>>');
  });

  it('resolves env token ports to numbers', () => {
    expect(resolveMockPort('e:MOCK_PORT', {MOCK_PORT: 9090})).toBe(9090);
    expect(resolveMockPort('<<e:MOCK_PORT>>', {MOCK_PORT: '9091'})).toBe(9091);
    expect(resolveMockPort(8080, {})).toBe(8080);
  });

  it('accepts env token protocols like e:MOCK_PROTOCOL', () => {
    const {data, errors} = parseMockData({
      type: 'server',
      protocol: 'e:MOCK_PROTOCOL',
      port: 8080,
      endpoints: [{method: 'get', path: '/health'}],
    });

    expect(errors.filter(error => error.severity === 'error')).toEqual([]);
    expect(data?.protocol).toBe('e:MOCK_PROTOCOL');
  });

  it('rejects incomplete protocol: e: nested-map values without crashing', () => {
    const {data, errors} = parseMockData({
      type: 'server',
      protocol: {e: null},
      port: 8080,
      endpoints: [{method: 'get', path: '/health'}],
    });

    expect(data).toBeNull();
    expect(errors.some(error => error.message.includes('protocol must be'))).toBe(true);
  });

  it('resolves env token protocols', () => {
    expect(resolveMockProtocol('e:MOCK_PROTOCOL', {MOCK_PROTOCOL: 'https'})).toBe('https');
    expect(resolveMockProtocol('<<e:MOCK_PROTOCOL>>', {MOCK_PROTOCOL: 'ws'})).toBe('ws');
    expect(resolveMockProtocol('http', {})).toBe('http');
  });

  it('rejects unresolved or invalid env token protocols', () => {
    expect(() => resolveMockProtocol('e:MISSING', {})).toThrow(/not one of/);
    expect(() => resolveMockProtocol('e:MOCK_PROTOCOL', {MOCK_PROTOCOL: 'ftp'})).toThrow(/not one of/);
  });
});