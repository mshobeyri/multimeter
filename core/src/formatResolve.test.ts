import {
  formatFromContentType,
  resolveRequestFormat,
  resolveResponseFormat,
} from './formatResolve';

describe('formatResolve', () => {
  it('maps content-type substrings to formats', () => {
    expect(formatFromContentType('application/json; charset=utf-8')).toBe('json');
    expect(formatFromContentType('text/html')).toBe('html');
    expect(formatFromContentType('multipart/form-data; boundary=x')).toBe('multipart');
    expect(formatFromContentType('')).toBeUndefined();
  });

  it('resolves request auto from Content-Type or defaults to json', () => {
    expect(resolveRequestFormat('json')).toBe('json');
    expect(resolveRequestFormat('auto', {'Content-Type': 'application/xml'})).toBe('xml');
    expect(resolveRequestFormat('auto', {})).toBe('json');
    expect(resolveRequestFormat('auto')).toBe('json');
  });

  it('resolves response auto from response headers, request format, then sniff', () => {
    expect(resolveResponseFormat('xml')).toBe('xml');
    expect(resolveResponseFormat('auto', {
      responseHeaders: {'content-type': 'application/json'},
      requestFormat: 'html',
    })).toBe('json');
    expect(resolveResponseFormat('auto', {
      requestFormat: 'html',
      body: 'plain',
    })).toBe('html');
    expect(resolveResponseFormat('auto', {
      body: '<!DOCTYPE html><html></html>',
    })).toBe('html');
    expect(resolveResponseFormat('auto', {
      body: '{"a":1}',
    })).toBe('json');
  });
});
