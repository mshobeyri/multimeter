import {apiToYaml, yamlToAPI, yamlToAPIStrict} from './apiParsePack';

describe('apiParsePack', () => {
  it('ignores legacy import blocks when parsing APIs', () => {
    const api = yamlToAPI([
      'type: api',
      'title: Example API',
      'import:',
      '  auth: ./auth.mmt',
      'url: https://example.com',
      'format: json',
    ].join('\n'));

    expect(api).toMatchObject({
      type: 'api',
      title: 'Example API',
      url: 'https://example.com',
      format: 'json',
    });
    expect('import' in api).toBe(false);
  });

  it('does not serialize import blocks for APIs', () => {
    const yaml = apiToYaml({
      type: 'api',
      title: 'Example API',
      url: 'https://example.com',
      format: 'json',
      inputs: {id: '123'},
    } as any);

    expect(yaml).toContain('type: api');
    expect(yaml).toContain('inputs:');
    expect(yaml).not.toContain('import:');
  });
});

describe('yamlToAPIStrict', () => {
  it('throws on invalid YAML syntax', () => {
    expect(() => yamlToAPIStrict('bad: [unclosed')).toThrow();
  });

  it('throws when type is not api', () => {
    expect(() => yamlToAPIStrict('type: test\nurl: http://x.com')).toThrow(/expected type "api"/);
  });

  it('throws when url is missing', () => {
    expect(() => yamlToAPIStrict('type: api\ntitle: No URL')).toThrow(/missing required "url"/);
  });

  it('parses valid API successfully', () => {
    const api = yamlToAPIStrict('type: api\nurl: http://example.com\nformat: json');
    expect(api.url).toBe('http://example.com');
    expect(api.type).toBe('api');
  });
});