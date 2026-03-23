import {apiToYaml, yamlToAPI} from './apiParsePack';

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