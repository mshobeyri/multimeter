import {
  formatFromContentType,
  headerContentType,
  resolveRequestFormat,
  resolveResponseFormat,
} from './formatResolve';

describe('formatFromContentType', () => {
  it('maps content-type substrings to formats', () => {
    expect(formatFromContentType('application/json; charset=utf-8')).toBe('json');
    expect(formatFromContentType('application/problem+json')).toBe('json');
    expect(formatFromContentType('text/html')).toBe('html');
    // html is checked before xml, so xhtml maps to html.
    expect(formatFromContentType('application/xhtml+xml')).toBe('html');
    expect(formatFromContentType('application/xml')).toBe('xml');
    expect(formatFromContentType('application/x-www-form-urlencoded')).toBe('urlencoded');
    expect(formatFromContentType('multipart/form-data; boundary=x')).toBe('multipart');
    expect(formatFromContentType('image/png')).toBe('binary');
    // xml substring wins over image/ for svg.
    expect(formatFromContentType('image/svg+xml')).toBe('xml');
    expect(formatFromContentType('application/octet-stream')).toBe('binary');
    expect(formatFromContentType('text/plain')).toBe('text');
    expect(formatFromContentType('text/csv')).toBeUndefined();
    expect(formatFromContentType('')).toBeUndefined();
  });
});

describe('headerContentType', () => {
  it('finds Content-Type case-insensitively', () => {
    expect(headerContentType({'Content-Type': 'application/json'})).toBe('application/json');
    expect(headerContentType({'content-type': 'text/xml'})).toBe('text/xml');
    expect(headerContentType({Accept: 'application/json'})).toBe('');
    expect(headerContentType(undefined)).toBe('');
  });
});

describe('resolveRequestFormat', () => {
  it('returns explicit formats unchanged', () => {
    expect(resolveRequestFormat('json')).toBe('json');
    expect(resolveRequestFormat('none')).toBe('none');
    expect(resolveRequestFormat('multipart')).toBe('multipart');
    expect(resolveRequestFormat('binary', {'Content-Type': 'application/json'})).toBe('binary');
  });

  it('resolves auto from Content-Type or defaults to json', () => {
    expect(resolveRequestFormat('auto', {'Content-Type': 'application/xml'})).toBe('xml');
    expect(resolveRequestFormat('auto', {'content-type': 'text/html'})).toBe('html');
    expect(resolveRequestFormat('auto', {'Content-Type': 'application/x-www-form-urlencoded'}))
        .toBe('urlencoded');
    expect(resolveRequestFormat('auto', {})).toBe('json');
    expect(resolveRequestFormat('auto')).toBe('json');
  });

  it('resolves auto to none only for GET', () => {
    expect(resolveRequestFormat('auto', {'Content-Type': 'application/json'}, 'get')).toBe('none');
    expect(resolveRequestFormat('auto', {}, 'GET')).toBe('none');
    expect(resolveRequestFormat('auto', {}, ' post ')).toBe('json');
    expect(resolveRequestFormat('auto', {}, 'head')).toBe('json');
    expect(resolveRequestFormat('auto', {}, 'options')).toBe('json');
  });

  it('keeps an explicit request format on GET', () => {
    expect(resolveRequestFormat('json', {}, 'get')).toBe('json');
    expect(resolveRequestFormat('text', {}, 'GET')).toBe('text');
    expect(resolveRequestFormat('urlencoded', {}, 'get')).toBe('urlencoded');
    expect(resolveRequestFormat('none', {}, 'post')).toBe('none');
  });
});

describe('resolveResponseFormat', () => {
  it('returns explicit formats unchanged', () => {
    expect(resolveResponseFormat('xml')).toBe('xml');
    expect(resolveResponseFormat('html')).toBe('html');
  });

  it('prefers response Content-Type over request format', () => {
    expect(resolveResponseFormat('auto', {
      responseHeaders: {'content-type': 'application/json'},
      requestFormat: 'html',
    })).toBe('json');
  });

  it('falls back to request format when no response Content-Type', () => {
    expect(resolveResponseFormat('auto', {
      requestFormat: 'html',
      body: 'plain',
    })).toBe('html');
    expect(resolveResponseFormat('auto', {
      requestFormat: 'none',
      body: 'plain',
    })).toBe('text');
  });

  it('sniffs body when headers and request format do not decide', () => {
    expect(resolveResponseFormat('auto', {
      body: '<!DOCTYPE html><html></html>',
    })).toBe('html');
    expect(resolveResponseFormat('auto', {
      body: '<html lang="en"></html>',
    })).toBe('html');
    expect(resolveResponseFormat('auto', {
      body: '{"a":1}',
    })).toBe('json');
    expect(resolveResponseFormat('auto', {
      body: '[1,2]',
    })).toBe('json');
    expect(resolveResponseFormat('auto', {
      body: '<note><to>A</to></note>',
    })).toBe('xml');
    expect(resolveResponseFormat('auto', {
      body: 'a=1&b=2',
    })).toBe('urlencoded');
    expect(resolveResponseFormat('auto', {
      body: 'just text',
    })).toBe('text');
    expect(resolveResponseFormat('auto', {
      body: '{not-json',
    })).toBe('text');
  });

  it('treats binary payloads as binary', () => {
    expect(resolveResponseFormat('auto', {
      body: {__mmtBinary: true, base64: 'AQID', byteLength: 3, contentType: 'image/png'},
    })).toBe('binary');
  });
});
