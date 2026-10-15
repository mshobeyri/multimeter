import {
  binaryBodyDataUrl,
  bytesToBase64,
  encodeBinaryBody,
  isBinaryBodyPayload,
  isBinaryContentType,
  normalizeHttpResponseBody,
  resolveBinaryPreviewMime,
  sniffImageMime,
} from './binaryBody';

describe('binaryBody', () => {
  it('detects binary content types', () => {
    expect(isBinaryContentType('image/png')).toBe(true);
    expect(isBinaryContentType('application/octet-stream')).toBe(true);
    expect(isBinaryContentType('application/json')).toBe(false);
    expect(isBinaryContentType('text/plain')).toBe(false);
  });

  it('sniffs common image signatures', () => {
    const png = Uint8Array.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
    expect(sniffImageMime(png)).toBe('image/png');
    const jpeg = Uint8Array.from([0xFF, 0xD8, 0xFF, 0xE0]);
    expect(sniffImageMime(jpeg)).toBe('image/jpeg');
    const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
    expect(sniffImageMime(svg)).toBe('image/svg+xml');
  });

  it('encodes binary payloads with preview mime', () => {
    const bytes = Uint8Array.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
    const payload = encodeBinaryBody(bytes, 'image/png');
    expect(isBinaryBodyPayload(payload)).toBe(true);
    expect(payload.byteLength).toBe(8);
    expect(payload.previewMime).toBe('image/png');
    expect(binaryBodyDataUrl(payload)).toMatch(/^data:image\/png;base64,/);
  });

  it('falls back to magic-byte sniffing when content-type is generic', () => {
    const bytes = Uint8Array.from([0xFF, 0xD8, 0xFF, 0xDB]);
    expect(resolveBinaryPreviewMime('application/octet-stream', bytes)).toBe('image/jpeg');
  });

  it('normalizes binary responses and keeps text responses as strings', () => {
    const pngBytes = Uint8Array.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
    const binary = normalizeHttpResponseBody(pngBytes, {'Content-Type': 'image/png'});
    expect(isBinaryBodyPayload(binary)).toBe(true);

    const text = normalizeHttpResponseBody(new TextEncoder().encode('hello'), {
      'Content-Type': 'text/plain',
    });
    expect(text).toBe('hello');
  });

  it('round-trips base64 encoding', () => {
    const bytes = Uint8Array.from([0, 255, 127, 128]);
    expect(bytesToBase64(bytes)).toBe('AP9/gA==');
  });
});
