import {mockToYaml, yamlToMock} from './mockParsePack';

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
});