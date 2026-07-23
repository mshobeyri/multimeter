import {
  normalizeFormat,
  packFormatSpec,
  requestFormat,
  responseFormat,
} from './CommonData';
import {apiToYaml, yamlToAPI, yamlToAPIStrict} from './apiParsePack';

describe('FormatSpec helpers', () => {
  it('treats a scalar format as both request and response', () => {
    expect(normalizeFormat('xml')).toEqual({request: 'xml', response: 'xml'});
    expect(requestFormat('urlencoded')).toBe('urlencoded');
    expect(responseFormat('urlencoded')).toBe('urlencoded');
  });

  it('supports split request/response formats', () => {
    expect(normalizeFormat({request: 'json', response: 'xml'})).toEqual({
      request: 'json',
      response: 'xml',
    });
  });

  it('accepts respond as an alias for response', () => {
    expect(normalizeFormat({request: 'json', respond: 'text'} as any)).toEqual({
      request: 'json',
      response: 'text',
    });
  });

  it('packs matching formats back to a scalar', () => {
    expect(packFormatSpec({request: 'json', response: 'json'})).toBe('json');
    expect(packFormatSpec({request: 'xml', response: 'json'})).toEqual({
      request: 'xml',
      response: 'json',
    });
  });
});

describe('API format parse/pack', () => {
  it('round-trips split format objects', () => {
    const yaml = [
      'type: api',
      'url: https://example.com/echo',
      'method: post',
      'format:',
      '  request: json',
      '  response: xml',
      'body:',
      '  name: ada',
    ].join('\n');

    const api = yamlToAPIStrict(yaml);
    expect(api.format).toEqual({request: 'json', response: 'xml'});
    expect(requestFormat(api.format)).toBe('json');
    expect(responseFormat(api.format)).toBe('xml');

    const packed = apiToYaml(api);
    expect(packed).toContain('request: json');
    expect(packed).toContain('response: xml');
  });

  it('keeps scalar format when request and response match', () => {
    const api = yamlToAPI('type: api\nurl: https://example.com\nformat: text');
    expect(api.format).toBe('text');
    expect(apiToYaml({...api, format: {request: 'text', response: 'text'}}))
        .toMatch(/format: text/);
  });

  it('parses format: binary with a path body', () => {
    const yaml = [
      'type: api',
      'url: https://example.com/upload',
      'method: post',
      'format: binary',
      'body: ./payload.bin',
    ].join('\n');
    const api = yamlToAPIStrict(yaml);
    expect(api.format).toBe('binary');
    expect(api.body).toBe('./payload.bin');
    expect(requestFormat(api.format)).toBe('binary');
    const packed = apiToYaml(api);
    expect(packed).toMatch(/format: binary/);
    expect(packed).toContain('body: ./payload.bin');
  });

  it('packs matching binary request/response as scalar format: binary', () => {
    expect(packFormatSpec({request: 'binary', response: 'binary'})).toBe('binary');
  });
});
