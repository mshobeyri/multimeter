import {
  formatDuration,
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
    expect(normalizeFormat('none')).toEqual({request: 'none', response: 'none'});
    expect(requestFormat('none')).toBe('none');
    expect(normalizeFormat('html')).toEqual({request: 'html', response: 'html'});
    expect(requestFormat('html')).toBe('html');
  });

  it('supports split request/response formats', () => {
    expect(normalizeFormat({request: 'json', response: 'xml'})).toEqual({
      request: 'json',
      response: 'xml',
    });
  });

  it('defaults response to auto when omitted from split format', () => {
    expect(normalizeFormat({request: 'json'})).toEqual({
      request: 'json',
      response: 'auto',
    });
    expect(responseFormat(undefined)).toBe('auto');
    expect(responseFormat({request: 'json'})).toBe('auto');
  });

  it('accepts auto as response format and packs split specs', () => {
    expect(normalizeFormat({request: 'json', response: 'auto'})).toEqual({
      request: 'json',
      response: 'auto',
    });
    expect(packFormatSpec({request: 'json', response: 'auto'})).toEqual({
      request: 'json',
      response: 'auto',
    });
    expect(normalizeFormat('auto' as any)).toEqual({
      request: 'json',
      response: 'auto',
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
    expect(packFormatSpec(undefined)).toBeUndefined();
    expect(normalizeFormat(null)).toEqual({request: 'json', response: 'auto'});
    expect(normalizeFormat('nope' as any)).toEqual({request: 'json', response: 'json'});
    expect(normalizeFormat(['xml'] as any)).toEqual({request: 'json', response: 'auto'});
  });

  it('formats durations across units', () => {
    expect(formatDuration(undefined)).toBe('0ms');
    expect(formatDuration(-1)).toBe('0ms');
    expect(formatDuration(12.4)).toBe('12ms');
    expect(formatDuration(1000)).toBe('1s');
    expect(formatDuration(1500)).toBe('1s 500ms');
    expect(formatDuration(60_000)).toBe('1m');
    expect(formatDuration(61_000)).toBe('1m 1s');
    expect(formatDuration(3_600_000)).toBe('1h');
    expect(formatDuration(3_660_000)).toBe('1h 1m');
    expect(formatDuration(86_400_000)).toBe('1d');
    expect(formatDuration(90_000_000)).toBe('1d 1h');
  });
});

describe('API format parse/pack', () => {
  it('round-trips response auto in split format objects', () => {
    const yaml = [
      'type: api',
      'url: https://example.com/echo',
      'method: post',
      'format:',
      '  request: json',
      '  response: auto',
    ].join('\n');

    const api = yamlToAPIStrict(yaml);
    expect(api.format).toEqual({request: 'json', response: 'auto'});
    expect(responseFormat(api.format)).toBe('auto');

    const packed = apiToYaml(api);
    expect(packed).toContain('request: json');
    expect(packed).toContain('response: auto');
  });

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

  it('parses format: none', () => {
    const api = yamlToAPIStrict([
      'type: api',
      'url: https://example.com/ping',
      'method: post',
      'format: none',
    ].join('\n'));
    expect(api.format).toBe('none');
    expect(requestFormat(api.format)).toBe('none');
    expect(apiToYaml(api)).toMatch(/format: none/);
  });

  it('parses format: multipart with a parts body', () => {
    const yaml = [
      'type: api',
      'url: https://example.com/upload',
      'method: post',
      'format: multipart',
      'body:',
      '  - name: meta',
      '    value: hello',
      '  - name: file',
      '    file: ./payload.bin',
    ].join('\n');
    const api = yamlToAPIStrict(yaml);
    expect(api.format).toBe('multipart');
    expect(Array.isArray(api.body)).toBe(true);
    expect(requestFormat(api.format)).toBe('multipart');
    const packed = apiToYaml(api);
    expect(packed).toMatch(/format: multipart/);
    expect(packed).toContain('name: meta');
  });
});
