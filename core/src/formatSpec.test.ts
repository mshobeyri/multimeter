import {
  formatDuration,
  normalizeFormat,
  packFormatSpec,
  requestFormat,
  responseFormat,
} from './CommonData';
import {apiToYaml, yamlToAPI, yamlToAPIStrict} from './apiParsePack';

describe('FormatSpec helpers', () => {
  it('treats a scalar format as request-only; response defaults to auto', () => {
    expect(normalizeFormat('xml')).toEqual({request: 'xml', response: 'auto'});
    expect(requestFormat('urlencoded')).toBe('urlencoded');
    expect(responseFormat('urlencoded')).toBe('auto');
    expect(normalizeFormat('none')).toEqual({request: 'none', response: 'auto'});
    expect(requestFormat('none')).toBe('none');
    expect(responseFormat('none')).toBe('auto');
    expect(normalizeFormat('html')).toEqual({request: 'html', response: 'auto'});
    expect(requestFormat('html')).toBe('html');
    expect(responseFormat('html')).toBe('auto');
  });

  it('supports split request/response formats', () => {
    expect(normalizeFormat({request: 'json', response: 'xml'})).toEqual({
      request: 'json',
      response: 'xml',
    });
  });

  it('defaults request and response to auto when omitted', () => {
    expect(normalizeFormat({request: 'json'})).toEqual({
      request: 'json',
      response: 'auto',
    });
    expect(normalizeFormat({})).toEqual({
      request: 'auto',
      response: 'auto',
    });
    expect(requestFormat(undefined)).toBe('auto');
    expect(responseFormat(undefined)).toBe('auto');
    expect(responseFormat({request: 'json'})).toBe('auto');
  });

  it('accepts auto as request/response format and packs split specs', () => {
    expect(normalizeFormat({request: 'json', response: 'auto'})).toEqual({
      request: 'json',
      response: 'auto',
    });
    expect(normalizeFormat({request: 'auto', response: 'auto'})).toEqual({
      request: 'auto',
      response: 'auto',
    });
    expect(packFormatSpec({request: 'json', response: 'auto'})).toBe('json');
    expect(packFormatSpec({request: 'auto', response: 'auto'})).toBe('auto');
    expect(normalizeFormat('auto')).toEqual({
      request: 'auto',
      response: 'auto',
    });
  });

  it('accepts respond as an alias for response', () => {
    expect(normalizeFormat({request: 'json', respond: 'text'} as any)).toEqual({
      request: 'json',
      response: 'text',
    });
  });

  it('coerces response none to auto', () => {
    expect(normalizeFormat({request: 'json', response: 'none'})).toEqual({
      request: 'json',
      response: 'auto',
    });
    expect(normalizeFormat({request: 'none', response: 'none'})).toEqual({
      request: 'none',
      response: 'auto',
    });
  });

  it('packs explicit matching formats as a split object', () => {
    // Scalar `format: json` means response:auto; keep request===response explicit.
    expect(packFormatSpec({request: 'json', response: 'json'})).toEqual({
      request: 'json',
      response: 'json',
    });
    expect(packFormatSpec({request: 'xml', response: 'json'})).toEqual({
      request: 'xml',
      response: 'json',
    });
    expect(packFormatSpec(undefined)).toBeUndefined();
    expect(normalizeFormat(null)).toEqual({request: 'auto', response: 'auto'});
    expect(normalizeFormat('nope' as any)).toEqual({request: 'json', response: 'auto'});
    expect(normalizeFormat(['xml'] as any)).toEqual({request: 'auto', response: 'auto'});
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
  it('round-trips response auto as scalar format', () => {
    const yaml = [
      'type: api',
      'url: https://example.com/echo',
      'method: post',
      'format:',
      '  request: json',
      '  response: auto',
    ].join('\n');

    const api = yamlToAPIStrict(yaml);
    expect(api.format).toBe('json');
    expect(requestFormat(api.format)).toBe('json');
    expect(responseFormat(api.format)).toBe('auto');

    const packed = apiToYaml(api);
    expect(packed).toMatch(/format: json/);
    expect(packed).not.toContain('response: auto');
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

  it('keeps explicit matching request/response as a split format', () => {
    const api = yamlToAPI('type: api\nurl: https://example.com\nformat: text');
    expect(api.format).toBe('text');
    expect(apiToYaml({...api, format: {request: 'text', response: 'text'}}))
        .toContain('request: text');
    expect(apiToYaml({...api, format: {request: 'text', response: 'text'}}))
        .toContain('response: text');
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

  it('packs matching binary request/response as a split format', () => {
    expect(packFormatSpec({request: 'binary', response: 'binary'})).toEqual({
      request: 'binary',
      response: 'binary',
    });
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
    expect(responseFormat(api.format)).toBe('auto');
    expect(packFormatSpec({request: 'none', response: 'auto'})).toBe('none');
    expect(apiToYaml(api)).toMatch(/format: none/);
  });

  it('drops legacy response none when parsing split format objects', () => {
    const api = yamlToAPIStrict([
      'type: api',
      'url: https://example.com/ping',
      'method: post',
      'format:',
      '  request: json',
      '  response: none',
    ].join('\n'));
    expect(api.format).toBe('json');
    expect(responseFormat(api.format)).toBe('auto');
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
