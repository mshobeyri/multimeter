import {encodeBinaryBody} from './binaryBody';
import {
  coerceResponseView,
  detectResponseFormat,
  displayResponseBody,
  resolveResponseDisplayState,
  resolveResponsePreviewImageUrl,
  resolveResponsePreviewKind,
  resolveResponseViewType,
  responseBodyToRawString,
  responseTypeSupportsPreview,
  responseTypeSupportsPretty,
} from './responseBodyDisplay';

describe('responseBodyDisplay', () => {
  it('serializes objects compactly without pretty-print', () => {
    expect(responseBodyToRawString({a: 1, b: [2]})).toBe('{"a":1,"b":[2]}');
    expect(responseBodyToRawString('already')).toBe('already');
    expect(responseBodyToRawString(null)).toBe('');
  });

  it('serializes binary payloads as base64 for raw view', () => {
    const payload = encodeBinaryBody(Uint8Array.from([0x89, 0x50, 0x4E, 0x47]), 'image/png');
    expect(responseBodyToRawString(payload)).toBe(payload.base64);
  });

  it('returns raw body when view is raw', () => {
    const raw = '{"a":1}';
    expect(displayResponseBody(
        {body: raw, headers: {'Content-Type': 'application/json'}} as any,
        {type: 'auto', view: 'raw', requestFormat: 'json'},
    )).toBe(raw);
  });

  it('beautifies JSON on display when view is pretty', () => {
    const raw = '{"a":1,"b":2}';
    const shown = displayResponseBody(
        {body: raw, headers: {'Content-Type': 'application/json'}} as any,
        {type: 'auto', view: 'pretty', requestFormat: 'json'},
    );
    expect(shown).toBe('{\n  "a": 1,\n  "b": 2\n}');
  });

  it('beautifies object bodies from compact JSON when view is pretty', () => {
    const shown = displayResponseBody(
        {body: {hello: 'world'}, headers: {'content-type': 'application/json'}} as any,
        {type: 'auto', view: 'pretty', requestFormat: 'json'},
    );
    expect(shown).toContain('\n');
    expect(shown).toContain('"hello": "world"');
  });

  it('returns stored string for preview', () => {
    const html = '<html><body>hi</body></html>';
    expect(displayResponseBody(
        {body: html, headers: {'Content-Type': 'text/html'}} as any,
        {type: 'auto', view: 'preview', requestFormat: 'json'},
    )).toBe(html);
  });

  it('detects html from content-type and doctype', () => {
    expect(detectResponseFormat({
      body: '<div/>',
      headers: {'Content-Type': 'text/html'},
    } as any)).toBe('html');
    expect(detectResponseFormat({
      body: '<!DOCTYPE html><html></html>',
      headers: {},
    } as any, 'json')).toBe('json');
    expect(detectResponseFormat({
      body: '<note>hi</note>',
      headers: {},
    } as any, 'html')).toBe('html');
  });

  it('detects binary payloads without relying on content sniffing', () => {
    const payload = encodeBinaryBody(Uint8Array.from([0x89, 0x50, 0x4E, 0x47]), 'image/png');
    expect(detectResponseFormat({
      body: payload,
      headers: {},
    } as any)).toBe('binary');
  });

  it('falls back to request format when response Content-Type is missing', () => {
    expect(detectResponseFormat({
      body: 'plain text',
      headers: {},
    } as any, 'html')).toBe('html');
    expect(detectResponseFormat({
      body: '{"a":1}',
      headers: {},
    } as any, 'json')).toBe('json');
    expect(resolveResponseViewType('auto', {
      body: '{"a":1}',
      headers: {},
    } as any, 'json', {})).toBe('json');
    expect(resolveResponseViewType('auto', {
      body: '{"a":1}',
      headers: {},
    } as any, 'auto', {'Content-Type': 'application/json'})).toBe('json');
  });

  it('resolves auto to the detected format', () => {
    expect(resolveResponseViewType('auto', {
      body: '{"a":1}',
      headers: {'content-type': 'application/json'},
    } as any, 'html')).toBe('json');
    expect(resolveResponseViewType('xml', {
      body: '{"a":1}',
      headers: {'content-type': 'application/json'},
    } as any, 'json')).toBe('xml');
  });

  it('supports pretty for structured and html types only', () => {
    expect(responseTypeSupportsPretty('auto', 'json')).toBe(true);
    expect(responseTypeSupportsPretty('json', 'json')).toBe(true);
    expect(responseTypeSupportsPretty('auto', 'html')).toBe(true);
    expect(responseTypeSupportsPretty('html', 'html')).toBe(true);
    expect(responseTypeSupportsPretty('auto', 'binary')).toBe(false);
    expect(responseTypeSupportsPretty('text', 'text')).toBe(false);
  });

  it('coerces unavailable views back to raw', () => {
    expect(coerceResponseView('pretty', false, true)).toBe('raw');
    expect(coerceResponseView('preview', true, false)).toBe('raw');
    expect(coerceResponseView('pretty', true, false)).toBe('pretty');
  });

  it('beautifies HTML on display when view is pretty', () => {
    const raw = '<html><body><p>hi</p></body></html>';
    const shown = displayResponseBody(
        {body: raw, headers: {'Content-Type': 'text/html'}} as any,
        {type: 'auto', view: 'pretty', requestFormat: 'json'},
    );
    expect(shown).toContain('\n');
    expect(shown).toContain('<p>hi</p>');
  });

  it('pretty-prints malformed HTML responses without throwing', () => {
    const raw = '<!doctype html><html><head><meta charset=UTF-8></head><body><div>ok</div></body></html>';
    expect(() => displayResponseBody(
        {body: raw, headers: {'Content-Type': 'text/html'}} as any,
        {type: 'auto', view: 'pretty', requestFormat: 'json'},
    )).not.toThrow();
    const shown = displayResponseBody(
        {body: raw, headers: {'Content-Type': 'text/html'}} as any,
        {type: 'auto', view: 'pretty', requestFormat: 'json'},
    );
    expect(shown).toContain('\n');
    expect(shown).toContain('<div>');
    expect(shown).toContain('ok');
  });

  it('shows preview for html or previewable binary images', () => {
    const payload = encodeBinaryBody(Uint8Array.from([0x89, 0x50, 0x4E, 0x47]), 'image/png');
    expect(responseTypeSupportsPreview('html', 'html')).toBe(true);
    expect(responseTypeSupportsPreview('auto', 'html')).toBe(true);
    expect(responseTypeSupportsPreview('auto', 'json')).toBe(false);
    expect(responseTypeSupportsPreview('auto', 'binary', payload)).toBe(true);
    expect(responseTypeSupportsPreview('binary', 'binary', payload)).toBe(true);
    expect(resolveResponsePreviewKind('auto', 'binary', payload)).toBe('image');
    expect(resolveResponsePreviewImageUrl(payload)).toMatch(/^data:image\/png;base64,/);
  });

  it('resolves display state for the response panel', () => {
    const html = '<html><body>hi</body></html>';
    const state = resolveResponseDisplayState(
        {body: html, headers: {'Content-Type': 'text/html'}} as any,
        {type: 'auto', view: 'pretty', requestFormat: 'json'},
    );
    expect(state.resolvedType).toBe('html');
    expect(state.prettyAvailable).toBe(true);
    expect(state.previewAvailable).toBe(true);
    expect(state.previewKind).toBe('html');
    expect(state.effectiveView).toBe('pretty');
    expect(state.displayText).toContain('\n');
    expect(state.previewHtml).toBe(html);
  });
});
