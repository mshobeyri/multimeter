import {envToYaml, yamlToEnv} from './envParsePack';
import {formatMmtYaml} from './mmtFormat';

describe('envParsePack', () => {
  it('serializes env files in canonical root order', () => {
    const yaml = envToYaml({
      type: 'env',
      certificates: {server_ca: './certs/ca.crt'},
      presets: {runner: {dev: {api_url: 'local'}}},
      variables: {api_url: {local: 'https://example.com'}},
      import: {shared: './shared.json'},
    });
    expect(yaml.indexOf('import:')).toBeLessThan(yaml.indexOf('variables:'));
    expect(yaml.indexOf('variables:')).toBeLessThan(yaml.indexOf('presets:'));
    expect(yaml.indexOf('presets:')).toBeLessThan(yaml.indexOf('certificates:'));
  });

  it('reorders shuffled env yaml through formatMmtYaml', () => {
    const input = `presets:
  runner:
    dev:
      api_url: local
certificates:
  server_ca: "./certs/ca.crt"
type: env
variables:
  api_url:
    local: "https://test.mmt.dev"
setting:
  http:
    timeout: 30000
    version: auto
import:
  shared: ./shared.json
`;
    const result = formatMmtYaml(input, 'multimeter.mmt');
    expect(result.docType).toBe('env');
    expect(result.changed).toBe(true);
    expect(result.formatted.indexOf('type: env')).toBe(0);
    expect(result.formatted.indexOf('import:')).toBeLessThan(result.formatted.indexOf('variables:'));
    expect(result.formatted.indexOf('variables:')).toBeLessThan(result.formatted.indexOf('presets:'));
    expect(result.formatted.indexOf('presets:')).toBeLessThan(result.formatted.indexOf('setting:'));
    expect(result.formatted.indexOf('setting:')).toBeLessThan(result.formatted.indexOf('certificates:'));
  });

  it('canonicalizes client certificate field order', () => {
    const env = yamlToEnv(`
type: env
variables:
  api_url:
    local: https://example.com
certificates:
  clients:
    - passphrase_env: CLIENT_CERT_PASS
      cert: ./certs/client.crt
      host: "*.example.com"
      key: ./certs/client.key
      name: Example API
`);
    const yaml = envToYaml(env);
    expect(yaml.indexOf('name:')).toBeLessThan(yaml.indexOf('host:'));
    expect(yaml.indexOf('host:')).toBeLessThan(yaml.indexOf('cert:'));
    expect(yaml.indexOf('cert:')).toBeLessThan(yaml.indexOf('key:'));
    expect(yaml.indexOf('key:')).toBeLessThan(yaml.indexOf('passphrase_env:'));
  });

  it('is idempotent after formatting', () => {
    const input = `type: env
variables:
  api_url:
    local: "https://test.mmt.dev"
presets:
  runner:
    dev:
      api_url: local
`;
    const first = formatMmtYaml(input, 'multimeter.mmt');
    const second = formatMmtYaml(first.formatted, 'multimeter.mmt');
    expect(second.changed).toBe(false);
  });
});
