import {
  detectResponseFormat,
  displayResponseBody,
  resolveResponseViewType,
  responseBodyToRawString,
  responseTypeSupportsPreview,
  responseTypeSupportsPretty,
} from './responseBodyDisplay';

describe('responseBodyDisplay', () => {
  it('serializes objects compactly without pretty-print', () => {
    expect(responseBodyToRawString({ a: 1, b: [2] })).toBe('{"a":1,"b":[2]}');
    expect(responseBodyToRawString('already')).toBe('already');
    expect(responseBodyToRawString(null)).toBe('');
  });

  it('returns raw body when view is raw', () => {
    const raw = '{"a":1}';
    expect(displayResponseBody(
      { body: raw, headers: { 'Content-Type': 'application/json' } } as any,
      { type: 'auto', view: 'raw' },
    )).toBe(raw);
  });

  it('beautifies JSON on display when view is pretty', () => {
    const raw = '{"a":1,"b":2}';
    const shown = displayResponseBody(
      { body: raw, headers: { 'Content-Type': 'application/json' } } as any,
      { type: 'auto', view: 'pretty' },
    );
    expect(shown).toBe('{\n  "a": 1,\n  "b": 2\n}');
  });

  it('beautifies object bodies from compact JSON when view is pretty', () => {
    const shown = displayResponseBody(
      { body: { hello: 'world' }, headers: { 'content-type': 'application/json' } } as any,
      { type: 'auto', view: 'pretty' },
    );
    expect(shown).toContain('\n');
    expect(shown).toContain('"hello": "world"');
  });

  it('returns stored string for preview', () => {
    const html = '<html><body>hi</body></html>';
    expect(displayResponseBody(
      { body: html, headers: { 'Content-Type': 'text/html' } } as any,
      { type: 'auto', view: 'preview' },
    )).toBe(html);
  });

  it('detects html from content-type and doctype', () => {
    expect(detectResponseFormat({
      body: '<div/>',
      headers: { 'Content-Type': 'text/html' },
    } as any)).toBe('html');
    expect(detectResponseFormat({
      body: '<!DOCTYPE html><html></html>',
      headers: {},
    } as any)).toBe('html');
    expect(detectResponseFormat({
      body: '<note>hi</note>',
      headers: {},
    } as any)).toBe('xml');
  });

  it('resolves auto to the detected format', () => {
    expect(resolveResponseViewType('auto', {
      body: '{"a":1}',
      headers: { 'content-type': 'application/json' },
    } as any)).toBe('json');
    expect(resolveResponseViewType('xml', {
      body: '{"a":1}',
      headers: { 'content-type': 'application/json' },
    } as any)).toBe('xml');
  });

  it('supports pretty for auto and structured types only', () => {
    expect(responseTypeSupportsPretty('auto')).toBe(true);
    expect(responseTypeSupportsPretty('json')).toBe(true);
    expect(responseTypeSupportsPretty('html')).toBe(false);
    expect(responseTypeSupportsPretty('text')).toBe(false);
  });

  it('shows preview only for html or auto that resolves to html', () => {
    expect(responseTypeSupportsPreview('html', 'html')).toBe(true);
    expect(responseTypeSupportsPreview('auto', 'html')).toBe(true);
    expect(responseTypeSupportsPreview('auto', 'json')).toBe(false);
    expect(responseTypeSupportsPreview('json', 'html')).toBe(false);
  });
});
